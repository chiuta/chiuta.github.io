// Teste Playwright pentru Provenienta. Fișierele C2PA sunt SINTETICE, generate aici de tests/synth.mjs (scris de autor).
// Nu sunt eșantioane oficiale și nu s-a testat pe fișiere reale de la aparate sau servicii.
// Rulare: node tests/test.mjs
import { createRequire } from 'module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as S from './synth.mjs';

const require = createRequire('/opt/node-tools/package.json');
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_FILE = path.resolve(HERE, '../index.html');
const APP = 'https://provenienta.test/index.html';
const AXE = process.env.AXE_PATH || '/tmp/claude-0/-home-claude/78529928-3825-51c3-b9bd-0e81655ab6bc/scratchpad/sweep/node_modules/axe-core/axe.min.js';
const W = fs.mkdtempSync(path.join(os.tmpdir(), 'provenienta-test-'));

const results = []; let current = '';
async function test(name, fn) {
  current = name; const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true }); console.log('  ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { results.push({ name, ok: false, err: e.stack || String(e) }); console.log('  FAIL ' + name + '\n       ' + String(e.message || e).split('\n').join('\n       ')); }
}
const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'not equal') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };

// ---------------------------------------------------------------- fixture de bază (imagini cu PIL)
const py = (code) => spawnSync('python3', ['-I', '-c', code], { cwd: W });
py(`from PIL import Image, ImageDraw
im=Image.new('RGB',(120,80))
d=ImageDraw.Draw(im)
for x in range(120):
  for y in range(80): im.putpixel((x,y),(20+x,40+y*2,(x*y)%256))
d.ellipse((30,15,90,65),fill=(255,230,200))
im.save('base.jpg',quality=75); im.save('base.png'); im.resize((32,20)).save('thumb.jpg',quality=60)
im.save('plain.webp')`);
const baseJpg = fs.readFileSync(path.join(W, 'base.jpg')), basePng = fs.readFileSync(path.join(W, 'base.png')), thumb = fs.readFileSync(path.join(W, 'thumb.jpg'));
const baseWebp = S.baseWebp(), baseSvg = S.baseSvg(), baseMp4 = S.baseMp4();
const signer = S.makeSigner({ alg: 'ES256', cn: 'Semnatar de test', chain: 'root' });
const std = (extra = {}) => ({ signer, assertions: [S.actionsAssertion(), S.exifAssertion(), S.thumbAssertion(thumb)], ...extra });
const jpegOk = S.signAsset('jpeg', baseJpg, std());

// ---------------------------------------------------------------- browser
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const netReqs = []; const pageErrors = [];
async function mkCtx(opts = {}) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, locale: 'ro-RO', serviceWorkers: 'block' }, opts));
  await ctx.route(/^https?:/, (r) => { const u = r.request().url(); if (u.startsWith('https://provenienta.test/index.html')) return r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(APP_FILE) });
    // fișiere auxiliare PWA (manifest, icoane) servite de pe disc din directorul aplicației: nu sunt cereri externe
    const m = /^https:\/\/provenienta\.test\/(manifest\.webmanifest|icon-192\.png|icon-512\.png|icon-maskable-512\.png)$/.exec(u);
    if (m) return r.fulfill({ status: 200, contentType: m[1].endsWith('png') ? 'image/png' : 'application/manifest+json', body: fs.readFileSync(path.resolve(HERE, '..', m[1])) });
    netReqs.push(u); r.abort(); });
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
  return ctx;
}
const ctx = await mkCtx();
async function openApp(c = ctx, url = APP) {
  const p = await c.newPage();
  p.on('pageerror', (e) => pageErrors.push(current + ': ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') pageErrors.push(current + ' console: ' + m.text()); });
  await p.goto(url); await p.evaluate(() => { try { localStorage.clear(); } catch (e) { /* */ } }); await p.reload();
  await p.waitForFunction(() => window.Provenienta && document.querySelector('#lang option'));
  return p;
}
const settled = (p, name, slot = 'A') => p.waitForFunction(([n, s]) => { const st = window.Provenienta.state; return !st.busy && st.res[s] && st.res[s].name === n; }, [name, slot], { timeout: 60000 });
async function loadBuf(p, buf, name, slot = 'A') { await p.setInputFiles('#file-' + slot, { name, mimeType: 'application/octet-stream', buffer: buf }); await settled(p, name, slot); }
const slim = (p, slot = 'A') => p.evaluate((s) => {
  const r = window.Provenienta.state.res[s]; const m = r.manifests[r.active];
  return { found: r.found, fatal: r.fatal, fmt: r.container && r.container.format, n: r.manifests.length, sig: m && m.sig.state, reason: m && m.sig.reason, bind: r.binding && r.binding.state, bindReason: r.binding && r.binding.reason, bindKind: r.binding && r.binding.kind,
    chain: m && m.sig.chain && m.sig.chain.state, validity: m && m.sig.certs[0] && m.sig.certs[0].validity, ai: r.summary && r.summary.ai.level, warn: r.warnings.map((w) => w.code), checks: m ? m.assertionChecks.map((a) => a.label + ':' + a.state) : [], alg: m && m.sig.algName, actions: m ? m.actions.map((a) => a.action) : [], thumb: !!(m && m.thumb), segs: r.container && r.container.segments, notes: r.container && r.container.notes };
}, slot);
const b64 = (b) => Buffer.from(b).toString('base64');
async function viaApi(p, buf, name = 'x.bin') { return p.evaluate(async ([s, n]) => { const u = Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); const r = await window.Provenienta.analyze(u, n); const m = r.manifests[r.active]; return { found: r.found, fatal: r.fatal, n: r.manifests.length, sig: m && m.sig.state, bind: r.binding && r.binding.state, fmt: r.container && r.container.format, warn: r.warnings.map((w) => w.code) }; }, [b64(buf), name]); }
const flip = (buf, i) => { const b = Buffer.from(buf); b[i] ^= 0x01; return b; };
const text = (p) => p.evaluate(() => document.querySelector('#result').innerText);

const page = await openApp();

await test('pornire: 0 erori, 0 CSP, 0 rețea, meta și versiune', async () => {
  const info = await page.evaluate(() => ({ csp: window.__csp, ver: document.querySelector('#app-version').textContent, mv: document.querySelector('meta[name=application-version]').content, up: document.querySelector('meta[name=last-updated]').content, lang: document.documentElement.lang, t: document.title, desc: !!document.querySelector('meta[name=description]').content, h1: document.querySelectorAll('h1').length, inline: document.querySelectorAll('[onclick],[onchange]').length }));
  eq(info.csp, []); eq(info.mv, '1.0.0'); eq(info.up, '2026-10-14'); assert(/v 1\.0\.0 · 2026-10-14/.test(info.ver)); eq(info.lang, 'ro'); eq(info.h1, 1); eq(info.inline, 0); assert(info.desc);
  const html = fs.readFileSync(APP_FILE, 'utf8');
  // CSP din meta (nu din tot fișierul: #fff-info descrie CSP-ul în JSON și ar da potriviri false pe „script-src … unsafe-inline”)
  const csp = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(html)[1]; const ss = /script-src([^;]*)/.exec(csp)[1];
  assert(/connect-src 'none'/.test(csp) && /default-src 'none'/.test(csp) && !/unsafe-eval/.test(csp)); assert(!/unsafe-/.test(ss));
  assert(/manifest-src 'self'(;|$)/.test(csp) && /worker-src 'self' blob:(;|$)/.test(csp) && /img-src 'self' data: blob:/.test(csp), csp);
  // hash independent pentru TOATE scripturile inline executabile (kit, pwa, aplicație) + verificările kitului și PWA
  const scr = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/\bsrc=/.test(m[1]) && !/type="application\/json"/.test(m[1]));
  eq(scr.length, 3, 'kit + pwa + aplicație'); eq((ss.match(/sha256-/g) || []).length, 3, 'hash-uri');
  for (const m of scr) assert(ss.includes("'sha256-" + crypto.createHash('sha256').update(m[2], 'utf8').digest('base64') + "'"), 'hash lipsă: ' + m[2].slice(0, 30));
  for (const [mod, a] of [['build.mjs', 'check'], ['pwa/pwa.mjs', 'check']]) { const r = spawnSync(process.execPath, [path.resolve(HERE, '../../../fff-kit', mod), a, path.resolve(HERE, '..')], { encoding: 'utf8' }); assert(r.status === 0, mod + ' check: ' + r.stdout + r.stderr); }
  assert(!/CNRED/i.test(html));
  eq(netReqs, []);
});

await test('JPEG valid: semnătură validă, fișier nemodificat, emitent neverificat', async () => {
  await loadBuf(page, jpegOk.file, 'ok.jpg');
  const r = await slim(page);
  eq([r.found, r.fatal, r.fmt, r.n, r.sig, r.bind, r.bindKind, r.alg, r.chain], [true, null, 'JPEG', 1, 'valid', 'match', 'data', 'ES256', 'complete']);
  assert(r.thumb, 'miniatură'); assert(r.checks.every((c) => c.endsWith(':match')), r.checks.join());
  assert(r.actions.includes('c2pa.created'));
  eq(r.ai, 'yes');
  const tx = await text(page);
  assert(tx.includes('Semnătură validă matematic') && tx.includes('Fișier nemodificat față de semnare') && tx.includes('Emitentul NU este verificat față de lista de încredere C2PA'), tx.slice(0, 600));
  assert(tx.includes('trainedAlgorithmicMedia') && tx.includes('DA — semnatarul declară conținut generat de AI'));
  assert(tx.includes('Semnatar de test') && tx.includes('SynthCam'), 'semnatar/EXIF');
  assert(await page.locator('img[alt^="Miniatura"]').count() === 1);
  assert(await page.locator('.badge.ai').count() >= 1);
});

await test('pixel modificat => hash nepotrivit (semnătura rămâne validă)', async () => {
  const f = flip(jpegOk.file, jpegOk.file.length - 20);
  await loadBuf(page, f, 'pix.jpg');
  const r = await slim(page); eq([r.sig, r.bind], ['valid', 'mismatch']);
  assert((await text(page)).includes('Fișierul DIFERĂ de cel semnat'));
});
await test('octet în semnătură => semnătură invalidă', async () => {
  const sm = S.signAsset('jpeg', baseJpg, std({ tamper: { sig: true } }));
  await loadBuf(page, sm.file, 'sig.jpg'); const r = await slim(page); eq([r.sig, r.reason, r.bind], ['invalid', 'badsig', 'match']);
  assert((await text(page)).includes('Semnătură INVALIDĂ'));
});
await test('revendicare modificată după semnare => semnătură invalidă', async () => {
  const sm = S.signAsset('jpeg', baseJpg, std({ tamper: { claimByte: true } })); await loadBuf(page, sm.file, 'claim.jpg'); eq((await slim(page)).sig, 'invalid');
});
await test('hash de afirmație alterat => nepotrivire raportată', async () => {
  const sm = S.signAsset('jpeg', baseJpg, std({ tamper: { assertionHash: true } })); await loadBuf(page, sm.file, 'ah.jpg');
  const r = await slim(page); assert(r.checks.some((c) => c.endsWith(':mismatch')) && r.warn.includes('assert.mismatch'), r.checks.join());
});
await test('octet modificat în interiorul manifestului (afirmație) => hash de afirmație nepotrivit', async () => {
  const f = Buffer.from(jpegOk.file); const i = f.indexOf(Buffer.from('c2pa.created')); f[i + 3] ^= 0x20;
  await loadBuf(page, f, 'in.jpg'); const r = await slim(page); assert(r.checks.some((c) => c.endsWith(':mismatch')), r.checks.join());
});
await test('certificat expirat: semnătură validă, avertisment de expirare', async () => {
  const sg = S.makeSigner({ alg: 'ES256', chain: 'self', notBefore: new Date(Date.UTC(2020, 0, 1)), notAfter: new Date(Date.UTC(2021, 0, 1)) });
  const sm = S.signAsset('jpeg', baseJpg, { signer: sg, assertions: [S.actionsAssertion()] }); await loadBuf(page, sm.file, 'exp.jpg');
  const r = await slim(page); eq([r.sig, r.validity], ['valid', 'expired']); assert(r.warn.includes('cert.expired'));
  assert((await text(page)).includes('EXPIRAT'));
});
await test('certificat încă nevalabil (notBefore în viitor) este semnalat', async () => {
  const sg = S.makeSigner({ alg: 'ES256', chain: 'self', notBefore: new Date(Date.UTC(2090, 0, 1)), notAfter: new Date(Date.UTC(2099, 0, 1)) });
  const sm = S.signAsset('jpeg', baseJpg, { signer: sg, assertions: [S.actionsAssertion()] }); await loadBuf(page, sm.file, 'nb.jpg'); eq((await slim(page)).validity, 'notyet');
});
await test('lanț: autosemnat complet, rădăcină inclusă, lanț rupt, fără x5chain', async () => {
  const mk = async (chain, name) => { const sg = S.makeSigner({ alg: 'ES256', chain }); const sm = S.signAsset('jpeg', baseJpg, { signer: sg, assertions: [S.actionsAssertion()] }); await loadBuf(page, sm.file, name); return slim(page); };
  let r = await mk('self', 'c1.jpg'); eq([r.sig, r.chain], ['valid', 'complete']);
  r = await mk('root', 'c2.jpg'); eq([r.sig, r.chain], ['valid', 'complete']);
  r = await mk('broken', 'c3.jpg'); eq([r.sig, r.chain], ['valid', 'broken']); assert(r.warn.includes('chain.broken'));
  r = await mk('none', 'c4.jpg'); eq(r.sig, 'unverifiable'); eq(r.reason, 'nox5');
});
await test('algoritmi COSE: ES384, ES512, PS256, Ed25519 + hash sha384/sha512', async () => {
  for (const [alg, hashAlg] of [['ES384', 'sha384'], ['ES512', 'sha512'], ['PS256', 'sha256'], ['PS384', 'sha384'], ['Ed25519', 'sha256']]) {
    const sg = S.makeSigner({ alg, chain: alg === 'PS256' ? 'self' : 'root' });
    const sm = S.signAsset('jpeg', baseJpg, { signer: sg, hashAlg, assertions: [S.actionsAssertion()] }); await loadBuf(page, sm.file, alg + '.jpg');
    const r = await slim(page);
    if (alg === 'Ed25519' && r.sig === 'unverifiable') { eq(r.reason, 'unsupportedbrowser'); console.log('       (Ed25519 nesuportat de acest browser — stare onestă)'); continue; }
    eq([alg, r.sig, r.bind, r.alg], [alg, 'valid', 'match', ({ ES384: 'ES384', ES512: 'ES512', PS256: 'PS256', PS384: 'PS384', Ed25519: 'EdDSA' })[alg]]);
  }
});
await test('x5chain în antetul protejat și revendicare v2', async () => {
  const sm = S.signAsset('jpeg', baseJpg, { signer, x5inProtected: true, version: 2, assertions: [S.actionsAssertion({ v2: true, source: S.SRC.capture })] }); await loadBuf(page, sm.file, 'v2.jpg');
  const r = await slim(page); eq([r.sig, r.bind, r.ai], ['valid', 'match', 'none']);
  assert((await text(page)).includes('v2'));
});
await test('PNG (caBX), WebP (C2PA), SVG, MP4 (BMFF), sidecar .c2pa', async () => {
  const cases = [['png', basePng, 'PNG', 'p.png'], ['webp', baseWebp, 'WebP', 'p.webp'], ['svg', baseSvg, 'SVG', 'p.svg'], ['mp4', baseMp4, 'ISO BMFF (isom)', 'p.mp4']];
  for (const [k, base, fmt, name] of cases) {
    const sm = S.signAsset(k, base, { signer, assertions: [S.actionsAssertion()] }); await loadBuf(page, sm.file, name);
    const r = await slim(page); eq([k, r.fmt, r.sig, r.bind], [k, fmt, 'valid', 'match']);
    // modificare în conținut => nepotrivire
    const pos = k === 'svg' ? sm.file.indexOf('<circle') + 2 : k === 'mp4' ? sm.file.length - 5 : k === 'png' ? sm.file.length - 20 : sm.file.length - 6 - (sm.range.length);
    await loadBuf(page, flip(sm.file, pos), 'm-' + name); const r2 = await slim(page); eq([k, r2.sig, r2.bind], [k, 'valid', 'mismatch']);
  }
  const sm = S.signAsset('jpeg', baseJpg, std()); await loadBuf(page, sm.store, 'side.c2pa');
  const r = await slim(page); eq([r.fmt, r.sig, r.bind, r.bindReason], ['JUMBF / .c2pa', 'valid', 'unverifiable', 'sidecar']);
  assert((await text(page)).includes('fără fișierul asociat'));
});
await test('MP4: variantă .v2 și fragmentat => neevaluat, fără blocare', async () => {
  const sm = S.signAsset('mp4', baseMp4, { signer, version: 2, assertions: [S.actionsAssertion({ v2: true })] }); await loadBuf(page, sm.file, 'v2.mp4'); const r = await slim(page); eq([r.sig, r.bind], ['valid', 'match']);
  const frag = S.signAsset('mp4', baseMp4, { signer, assertions: [S.actionsAssertion()] }).file; const moof = S.box('moof', Buffer.alloc(8)); await loadBuf(page, Buffer.concat([frag, moof]), 'frag.mp4');
  const r2 = await slim(page); eq([r2.sig, r2.bind, r2.bindReason], ['valid', 'unverifiable', 'bmffunsupported']);
});
await test('manifest în mai multe segmente JPEG APP11 (reasamblare), miniatură mare', async () => {
  const big = Buffer.concat([thumb, Buffer.alloc(150000, 7)]);
  const sm = S.signAsset('jpeg', baseJpg, { signer, assertions: [S.actionsAssertion(), { label: 'com.example.blob', bin: big, mime: 'application/octet-stream' }] }); await loadBuf(page, sm.file, 'multi.jpg');
  const r = await slim(page); assert(r.segs >= 3, 'segmente ' + r.segs); eq([r.sig, r.bind], ['valid', 'match']); assert(r.checks.every((c) => c.endsWith(':match')));
});
await test('două manifeste (ingredient): cronologie, manifest activ, AI parțial', async () => {
  const sg2 = S.makeSigner({ alg: 'ES256', cn: 'Editor B', chain: 'root' });
  const old = S.makeManifest({ signer, title: 'a.jpg', assertions: [S.actionsAssertion({ source: S.SRC.capture })], hashAssertion: { label: 'c2pa.hash.data', cbor: { exclusions: [], alg: 'sha256', hash: crypto.createHash('sha256').update(baseJpg).digest(), name: 'x' } } });
  const sm = S.signAsset('jpeg', baseJpg, { signer: sg2, prior: [old.box], assertions: [S.actionsAssertion({ source: S.SRC.composite })] }); await loadBuf(page, sm.file, 'two.jpg');
  const r = await slim(page); eq([r.n, r.sig, r.bind, r.ai], [2, 'valid', 'match', 'partial']);
  const tx = await text(page); assert(tx.includes('Editor B') && tx.includes('compositeWithTrainedAlgorithmicMedia') && /anterior/.test(tx));
  assert(await page.locator('ol.tl > li').count() === 2);
});
await test('fără manifest: mesaj clar, fără „fals/real”, JPEG/PNG/WebP/PDF/GIF', async () => {
  for (const [buf, name] of [[baseJpg, 'n.jpg'], [basePng, 'n.png'], [fs.readFileSync(path.join(W, 'plain.webp')), 'n.webp']]) {
    await loadBuf(page, buf, name); const r = await slim(page); eq([r.found, r.n], [false, 0]);
    const tx = await text(page); assert(tx.includes('Nu s-a găsit niciun manifest C2PA') && tx.includes('NU înseamnă că fișierul este fals și nici că este real'), tx.slice(0, 400));
  }
  await loadBuf(page, Buffer.from('%PDF-1.7\n1 0 obj<<>>endobj\n%%EOF'), 'n.pdf'); assert((await text(page)).includes('nu s-a găsit niciun indiciu') || (await text(page)).includes('niciun indiciu'));
  await loadBuf(page, Buffer.from('%PDF-1.7\n1 0 obj<</Type/EmbeddedFile/Subtype/application#2Fc2pa>>endobj\n/C2PA_Manifest 3 0 R'), 'c.pdf');
  const t2 = await text(page); assert(t2.includes('indiciu de manifest C2PA') && t2.includes('NU au fost verificate'));
  await loadBuf(page, Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00;', 'latin1'), 'g.gif'); assert((await text(page)).includes('Format neacceptat (GIF)'));
  await loadBuf(page, Buffer.from('hello world, plain text'), 'x.txt'); assert((await text(page)).includes('Format neacceptat'));
  await loadBuf(page, Buffer.alloc(0), 'empty.bin'); assert((await text(page)).includes('Format neacceptat'));
});
await test('JUMBF trunchiat / CBOR rău format: fără blocare', async () => {
  const cut = jpegOk.file.subarray(0, jpegOk.range.start + 400); await loadBuf(page, cut, 'cut.jpg'); const r = await slim(page); assert(!r.fatal);
  // trunchiere în interiorul store-ului, cu segment complet: modifică lungimea cutiei
  const trunc = S.wrapStore([jpegOk.active.box]).subarray(0, 300); const t1 = await viaApi(page, trunc, 'x.c2pa'); assert(!t1.fatal && t1.sig !== 'valid', JSON.stringify(t1));
  // CBOR corupt în cutia claim
  const bad = Buffer.from(jpegOk.file); const i = bad.indexOf(Buffer.from('c2pa.claim')); const j = bad.indexOf(Buffer.from('cbor'), i); bad[j + 4] = 0xff;
  await loadBuf(page, bad, 'badcbor.jpg'); const r2 = await slim(page); assert(!r2.fatal); assert(r2.sig !== 'valid', 'sig ' + r2.sig);
  assert(r2.warn.includes('struct.data'), r2.warn.join());
  const tx = await text(page); assert(tx.length > 100);
  // PNG cu caBX trunchiat
  const sp = S.signAsset('png', basePng, std()); await loadBuf(page, sp.file.subarray(0, sp.range.start + 120), 'cut.png'); assert(!(await slim(page)).fatal);
});
await test('fuzz: 400 corupții aleatoare ale manifestului nu produc excepții', async () => {
  const rnd = crypto.createHash('sha256'); let seed = 12345; const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const base = jpegOk.file; const { start, length } = jpegOk.range; const variants = [];
  for (let i = 0; i < 400; i++) { const b = Buffer.from(base); const n = 1 + Math.floor(rand() * 4); for (let k = 0; k < n; k++) b[start + Math.floor(rand() * length)] = Math.floor(rand() * 256); variants.push(i % 7 === 0 ? b.subarray(0, start + Math.floor(rand() * length)) : b); }
  const out = await page.evaluate(async (list) => { let fatal = 0, ok = 0; for (const s of list) { const u = Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); const r = await window.Provenienta.analyze(u, 'f'); if (r.fatal) fatal++; else ok++; } return { fatal, ok }; }, variants.map(b64));
  eq(out.fatal, 0); void rnd;
});
await test('CBOR propriu: tipuri 0–7, taguri, lungime nedefinită, chei întregi, erori', async () => {
  const r = await page.evaluate(() => {
    const D = (h) => { const u = Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16))); return window.Provenienta.cborDecode(u).value; };
    const P = (v) => window.Provenienta.toPlain(v);
    const out = {};
    out.ints = [D('00'), D('17'), D('1818'), D('1903e8'), D('1a000f4240'), D('20'), D('3863')];
    out.big = String(D('1bffffffffffffffff'));
    out.str = [D('6449455446'), D('60')];
    out.bytes = P(D('4401020304'));
    out.arr = P(D('83010203')); out.map = P(D('a2616101616282'+'0203'));
    out.intkey = D('a20102 03 04'.replace(/ /g, '')).get(3);
    out.tag = P(D('c074323031332d30332d32315432303a30343a30305a'));
    out.simple = [D('f4'), D('f5'), D('f6')];
    out.floats = [D('f93c00'), D('f97bff'), D('fa47c35000'), D('fb3ff199999999999a')];
    out.indef = [P(D('5f42010243030405ff')), D('7f657374726561646d696e67ff'), P(D('9f018202039f0405ffff')), P(D('bf61610161629f0203ffff'))];
    const errs = []; for (const h of ['', '18', '8301', '5f', 'a1', 'ff', '1c', 'bf6161ff', '5f4101']) { try { D(h || '00'.repeat(0) || ''); errs.push('ok:' + h); } catch (e) { errs.push('err'); } }
    out.errs = errs;
    try { window.Provenienta.cborDecode(new Uint8Array(0)); out.empty = 'ok'; } catch (e) { out.empty = 'err'; }
    return out;
  });
  eq(r.ints, [0, 23, 24, 1000, 1000000, -1, -100]); eq(r.big, '18446744073709551615'); eq(r.str, ['IETF', '']); eq(r.bytes, { $bytes: 4, hex: '01020304' });
  eq(r.arr, [1, 2, 3]); eq(r.intkey, 4); eq(r.tag, { $tag: 0, value: '2013-03-21T20:04:00Z' });
  eq(r.simple, [false, true, null]); eq(r.floats, [1, 65504, 100000, 1.1]);
  eq(r.indef[1], 'streaming'); eq(r.indef[0], { $bytes: 5, hex: '0102030405' }); eq(r.indef[2], [1, [2, 3], [4, 5]]); eq(r.indef[3], { a: 1, b: [2, 3] });
  eq(r.errs.slice(1), ['err', 'err', 'err', 'err', 'err', 'err', 'err', 'err']); eq(r.empty, 'err');
});
await test('ASN.1/X.509 propriu coincide cu node:crypto (subiect, emitent, date, serie, amprentă)', async () => {
  for (const alg of ['ES256', 'ES384', 'PS256']) {
    const sg = S.makeSigner({ alg, cn: 'Test ĂÎȘ ' + alg, chain: 'root' }); const leaf = sg.certs[0];
    const x = new crypto.X509Certificate(leaf);
    const got = await page.evaluate(async (s) => { const u = Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); const c = window.Provenienta.parseCert(u); return { cn: c.subject.fields.CN, issuer: c.issuer.fields.CN, nb: c.notBefore.toISOString(), na: c.notAfter.toISOString(), serial: c.serialHex, key: c.key.name, ca: c.ca, ku: c.exts.keyUsage, eku: c.exts.eku }; }, b64(leaf));
    eq(got.cn, 'Test ĂÎȘ ' + alg); eq(got.issuer, 'Provenienta Synthetic Test Root CA'); eq(new Date(got.nb).getTime(), new Date(x.validFrom).getTime()); eq(new Date(got.na).getTime(), new Date(x.validTo).getTime());
    eq(parseInt(got.serial, 16), 7); eq(got.ca, false); eq(got.ku, ['digitalSignature']); eq(got.eku, ['emailProtection']);
    assert(alg === 'PS256' ? got.key === 'RSA 2048' : got.key.startsWith('EC P-'), got.key);
  }
});
await test('exemplul încorporat: verificat corect (2 manifeste, hash potrivit)', async () => {
  await page.click('#sample'); await page.waitForFunction(() => window.Provenienta.state.res.A && !window.Provenienta.state.busy);
  const r = await slim(page); eq([r.n, r.sig, r.bind, r.ai, r.thumb], [2, 'valid', 'match', 'partial', true]);
  assert((await text(page)).includes('Exemplu sintetic') || (await page.locator('#sample-note').innerText()).includes('sintetic'));
});
await test('comparare A/B: diferențe evidențiate', async () => {
  const p = await openApp();
  await p.click('#mode-compare'); assert(await p.locator('#slot-B').isVisible());
  await loadBuf(p, jpegOk.file, 'a.jpg', 'A'); await loadBuf(p, flip(jpegOk.file, jpegOk.file.length - 20), 'b.jpg', 'B');
  const tx = await text(p); assert(/\d+ diferențe între A și B/.test(tx), tx.slice(0, 300));
  const diffRows = await p.locator('tr.diff').count(); assert(diffRows >= 2, 'rânduri diferite ' + diffRows);
  assert((await p.locator('tr.diff th').allInnerTexts()).some((x) => /SHA-256/.test(x)));
  await p.click('#cmp-view-b'); assert((await text(p)).includes('b.jpg')); assert(await p.locator('#slot-B').isHidden());
  await p.click('#mode-compare'); await p.click('#sample'); await p.waitForFunction(() => window.Provenienta.state.res.B && !window.Provenienta.state.busy);
  assert((await text(p)).includes('Cele două fișiere au') === false); assert(/[1-9]\d* diferențe/.test(await text(p)));
  await p.close();
});
await test('export JSON/Markdown: fără conținut de fișier, miniaturi sau nume când nu e bifat', async () => {
  const p = await openApp(); await loadBuf(p, jpegOk.file, 'secret-nume.jpg');
  const dl = async (sel) => { const [d] = await Promise.all([p.waitForEvent('download'), p.click(sel)]); const f = path.join(W, 'dl-' + Date.now()); await d.saveAs(f); return [d.suggestedFilename(), fs.readFileSync(f)]; };
  let [nm, js] = await dl('#x-json-btn'); assert(/\.json$/.test(nm) && nm.includes('secret-nume'));
  const rep = JSON.parse(js.toString()); eq([rep.format, rep.schema, rep.manifestFound, rep.trustListChecked, rep.experimental], ['provenienta-report', 1, true, false, true]);
  eq(rep.signature.state, 'valid'); eq(rep.binding.state, 'match'); assert(rep.file.name === 'secret-nume.jpg' && rep.file.sha256.length === 64);
  const raw = js.toString(); assert(!raw.includes(b64(thumb).slice(0, 40)) && !raw.includes(thumb.subarray(0, 16).toString('hex')), 'miniatură în raport');
  assert(!raw.includes('SynthCam'), 'valori EXIF fără bifă'); assert(rep.manifests[0].assertions.every((a) => a.value === undefined));
  assert(rep.limits.length === 7 && rep.manifests[0].certificates[0].sha256);
  await p.uncheck('#x-name'); await p.check('#x-details');
  [nm, js] = await dl('#x-json-btn'); assert(!nm.includes('secret-nume')); const r2 = JSON.parse(js.toString()); assert(r2.file.name === undefined && !js.toString().includes('secret-nume'));
  assert(js.toString().includes('SynthCam'), 'detalii bifate'); assert(!js.toString().includes(thumb.subarray(0, 16).toString('hex')));
  const [mn, md] = await dl('#x-md-btn'); assert(/\.md$/.test(mn)); const m = md.toString(); assert(m.includes('# Provenienta') && m.includes('Emitentul NU este verificat') && m.includes('## ') && !m.includes('secret-nume'));
  await p.close();
});
await test('8 limbi: aceleași chei, selector, persistență, html[lang], fără termeni interziși', async () => {
  const p = await openApp();
  const info = await p.evaluate(() => { const T = window.Provenienta.T; const ro = Object.keys(T.ro).sort(); const out = {}; for (const l of Object.keys(T)) { const k = Object.keys(T[l]).sort(); out[l] = { missing: ro.filter((x) => !k.includes(x)), extra: k.filter((x) => !ro.includes(x)), empty: k.filter((x) => !String(T[l][x]).trim()) }; } return { langs: Object.keys(T), out, all: JSON.stringify(T) }; });
  eq(info.langs, ['ro', 'en', 'fr', 'it', 'es', 'pt', 'hu', 'de']);
  for (const l of info.langs) eq(info.out[l], { missing: [], extra: [], empty: [] }, l);
  assert(!/autentic|authentic|authentiq|hiteles|authentisch/i.test(info.all), 'termen interzis în dicționar');
  for (const l of ['en', 'fr', 'it', 'es', 'pt', 'hu', 'de', 'ro']) {
    await p.selectOption('#lang', l); assert((await p.evaluate(() => document.documentElement.lang)) === l);
    await loadBuf(p, jpegOk.file, 'l-' + l + '.jpg'); const tx = await text(p); assert(tx.length > 500 && !/\{\w+\}/.test(tx), l + ' acoladă netradusă');
    assert(!/autentic|authentic|authentiq|hiteles|authentisch/i.test(tx), l);
  }
  await p.selectOption('#lang', 'hu'); await p.reload(); await p.waitForFunction(() => window.Provenienta); eq(await p.evaluate(() => document.documentElement.lang), 'hu'); eq(await p.evaluate(() => localStorage.getItem('fff.provenienta.lang')), 'hu');
  await p.click('#reset-prefs'); eq(await p.evaluate(() => localStorage.getItem('fff.provenienta.lang')), null);
  await p.close();
});
await test('funcționează fără localStorage (blocat) și din file://', async () => {
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 } }); await c.route(/^https?:/, (r) => r.abort());
  await c.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocat'); } }); });
  const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + APP_FILE); await p.waitForFunction(() => window.Provenienta && document.querySelector('#lang option'));
  await p.setInputFiles('#file-A', { name: 'f.jpg', mimeType: 'image/jpeg', buffer: jpegOk.file }); await settled(p, 'f.jpg'); eq((await slim(p)).sig, 'valid');
  await p.selectOption('#lang', 'de'); eq(await p.evaluate(() => document.documentElement.lang), 'de'); eq(errs, []); await c.close();
});
await test('tastatură: butoanele pot fi atinse cu Tab și activate; comutator mod', async () => {
  const p = await openApp(); const seen = new Set();
  for (let i = 0; i < 12; i++) { await p.keyboard.press('Tab'); seen.add(await p.evaluate(() => document.activeElement.id || document.activeElement.className)); }
  for (const id of ['lang', 'theme', 'mode-single', 'mode-compare', 'choose-A', 'sample', 'clear']) assert(seen.has(id), 'lipsă ' + id + ' din ' + [...seen]);
  await p.focus('#mode-compare'); await p.keyboard.press('Enter'); assert(await p.locator('#slot-B').isVisible());
  await p.focus('#theme'); await p.keyboard.press('Enter'); assert(['dark', 'light'].includes(await p.evaluate(() => document.documentElement.dataset.theme)));
  await p.close();
});
const axeSrc = fs.existsSync(AXE) ? fs.readFileSync(AXE, 'utf8') : null;
async function axeRun(p) { await p.addScriptTag({ content: axeSrc }).catch(() => {}); await p.waitForTimeout(3600); return p.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map((v) => v.id + ': ' + v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | '))); }
await test('axe: 0 violări (luminos/întunecat, rezultate, comparare) și fără depășire 360/1280', async () => {
  assert(axeSrc, 'axe-core lipsește');
  for (const scheme of ['light', 'dark']) {
    const c = await mkCtx({ colorScheme: scheme, bypassCSP: true }); const p = await openApp(c);
    let v = await axeRun(p); eq(v, [], scheme + ' gol');
    await p.click('#sample'); await p.waitForFunction(() => window.Provenienta.state.res.A && !window.Provenienta.state.busy);
    await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    v = await axeRun(p); eq(v, [], scheme + ' rezultat');
    await p.click('#mode-compare'); await p.click('#sample'); await p.waitForFunction(() => window.Provenienta.state.res.B && !window.Provenienta.state.busy);
    v = await axeRun(p); eq(v, [], scheme + ' comparare');
    const nores = await p.evaluate(() => 0); void nores;
    await c.close();
  }
  for (const [w, hh] of [[360, 740], [1280, 800]]) {
    const c = await mkCtx({ viewport: { width: w, height: hh }, bypassCSP: true }); const p = await openApp(c);
    await p.click('#sample'); await p.waitForFunction(() => window.Provenienta.state.res.A && !window.Provenienta.state.busy);
    await p.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    let o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert(o <= 0, 'depășire ' + w + ': ' + o);
    await p.click('#mode-compare'); await p.click('#sample'); await p.waitForFunction(() => window.Provenienta.state.res.B && !window.Provenienta.state.busy);
    o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert(o <= 0, 'depășire comparare ' + w + ': ' + o);
    await c.close();
  }
});
await test('0 erori de pagină, 0 CSP încălcate, 0 cereri de rețea pe tot parcursul', async () => {
  eq(pageErrors, []); eq(netReqs, []);
  eq(await page.evaluate(() => window.__csp), []);
});

await browser.close();
fs.rmSync(W, { recursive: true, force: true });
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} teste trecute`);
if (failed.length) { process.exitCode = 1; }
