// Teste DOM pentru fff-texturi (Playwright): cum primește pagina textura (body/html, strat fix pentru gradient), realegerea la schimbarea temei,
// precontrolul CSP (img-src fără data:), oprirea singură la o violare raportată de browser și pornit/oprit.
// Rulare: node tests/texturi-dom.test.mjs [filtru-nume]. Browser: CHROMIUM_PATH sau Chromium/Chrome din locurile obișnuite; FFF_NODE_TOOLS = package.json cu playwright.
// Paginile sunt sintetice (setContent), fără rețea; motorul e injectat ca script inline, deci CSP-urile de test admit 'unsafe-inline' pentru scripturi.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const require = createRequire(process.env.FFF_NODE_TOOLS || '/opt/node-tools/package.json');
const {chromium} = require('playwright');
const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = fs.readFileSync(path.join(HUB, 'tools', 'fff-texturi.js'), 'utf8');
const CHROME = process.env.CHROMIUM_PATH || ['/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find((f) => fs.existsSync(f));
const ARGS = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const only = process.argv[2];
const results = [];
async function T(name, fn) {
  if (only && !name.includes(only)) return;
  const t0 = Date.now();
  try { await fn(); results.push([name, true]); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { results.push([name, false]); console.log('FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 5).join('\n       ')); }
}
const ok = (c, m) => { if (!c) throw new Error(m); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(m + ': așteptat ' + JSON.stringify(b) + ', primit ' + JSON.stringify(a)); };

const GRAD = 'linear-gradient(160deg,#0b1030,#3a0b2a)';
const page = (css, csp = '') => '<!doctype html><html lang="ro" data-mode="light"><head><meta charset="utf-8">' +
  (csp ? '<meta http-equiv="Content-Security-Policy" content="' + csp + '">' : '') + '<title>t</title><style>body{margin:0;min-height:100vh;font:16px system-ui}' +
  'section{background:rgba(255,255,255,.9);border-radius:12px;padding:20px;margin:20px auto;max-width:600px}' + css + '</style></head>' +
  '<body><section><h2>Panou</h2><p>text</p></section><section><h2>Alt panou</h2><p>text</p></section></body></html>';
const CSP_OK = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:";

const browser = await chromium.launch({executablePath: CHROME, args: ARGS});
async function open(html) {
  const ctx = await browser.newContext({viewport: {width: 900, height: 600}});
  await ctx.addInitScript(() => { window.FFF_TEXTURI_FORCE = 1; window.FFF_TEXTURI_SIZE = 256; });
  const pg = await ctx.newPage();
  await pg.setContent(html);
  await pg.evaluate(() => { window.FFF_TEXTURI_FORCE = 1; window.FFF_TEXTURI_SIZE = 256; });
  await pg.addScriptTag({content: ENGINE});
  // sondaj cu evaluate (waitForFunction ar fi blocat de CSP-urile fără unsafe-eval)
  const t0 = Date.now(); let info = null;
  while (Date.now() - t0 < 150000) {
    info = await pg.evaluate(() => (window.FFF && window.FFF.texturi && window.FFF.texturi.info()) || null);
    if (info) break;
    await pg.waitForTimeout(250);
  }
  ok(info, 'motorul nu a raportat nicio stare în 150 s');
  return {ctx, pg, info};
}
const st = (pg) => pg.evaluate(() => {
  const b = document.body, cb = getComputedStyle(b), bd = document.querySelector('[data-fffx="b"]'), cd = bd && getComputedStyle(bd);
  return {page: (window.FFF.texturi.info() || {}).page, bodyMark: b.getAttribute('data-fffx'), htmlMark: document.documentElement.getAttribute('data-fffx'),
    bodyGrad: cb.backgroundImage.indexOf('gradient') >= 0, bodyData: cb.backgroundImage.indexOf('data:image') >= 0,
    backdrop: !!bd, bdParent: bd ? bd.parentNode.tagName : null, bdPos: cd && cd.position, bdZ: cd && cd.zIndex, bdImg: !!cd && cd.backgroundImage.indexOf('data:image') >= 0,
    on: document.documentElement.hasAttribute('data-fffx-on'), get: window.FFF.texturi.get()};
});

await T('engine: versiune, API și materiale (în browser)', async () => {
  const {ctx, pg} = await open(page('body{background:#f4f1ea}', CSP_OK));
  const r = await pg.evaluate(() => ({v: window.FFF.texturi.version, m: window.FFF.texturi.materials().length, gl: window.FFF.texturi.hasGL()}));
  ok(/^\d+\.\d+\.\d+$/.test(r.v) && r.m >= 18, 'API: ' + JSON.stringify(r));
  await ctx.close();
});

await T('body cu culoare plină: textura merge pe body (marcaj g), fără strat fix', async () => {
  const {ctx, pg, info} = await open(page('body{background:#f4f1ea}', CSP_OK));
  ok(info.on, 'pornit: ' + JSON.stringify(info));
  const s = await st(pg);
  eq([s.page, s.bodyMark, s.backdrop, s.bodyData], ['body', 'g', false, true], 'body plin');
  await ctx.close();
});

await T('gradient pe body (html gol): strat fix sub conținut, gradientul aplicației rămâne', async () => {
  const {ctx, pg} = await open(page('body{background:' + GRAD + '}', CSP_OK));
  const s = await st(pg);
  eq([s.page, s.bodyMark, s.bodyGrad, s.backdrop, s.bdParent, s.bdPos, s.bdZ, s.bdImg], ['backdrop', null, true, true, 'HTML', 'fixed', '-1', true], 'gradient pe body');
  await ctx.close();
});

await T('gradient pe html (body transparent): strat fix', async () => {
  const {ctx, pg} = await open(page('html{background:' + GRAD + '}', CSP_OK));
  const s = await st(pg);
  eq([s.page, s.backdrop, s.bdImg], ['backdrop', true, true], 'gradient pe html');
  await ctx.close();
});

await T('html opac + body cu gradient, sau gradient pe ambele: fără textură de pagină (ar fi acoperită)', async () => {
  for (const css of ['html{background:#123}body{background:' + GRAD + '}', 'html{background:linear-gradient(#123,#234)}body{background:' + GRAD + '}']) {
    const {ctx, pg} = await open(page(css, CSP_OK));
    const s = await st(pg);
    eq([s.page, s.bodyMark, s.htmlMark, s.backdrop], ['', null, null, false], css);
    await ctx.close();
  }
});

await T('schimbarea temei: culoare plină ↔ gradient realege ținta și păstrează gradientul aplicației', async () => {
  const css = 'html[data-mode=light] body{background:#f4f1ea}html[data-mode=dark] body{background:' + GRAD + '}';
  const {ctx, pg} = await open(page(css, CSP_OK));
  let s = await st(pg);
  eq([s.page, s.bodyMark, s.backdrop], ['body', 'g', false], 'lumină');
  await pg.evaluate(() => document.documentElement.setAttribute('data-mode', 'dark'));
  for (let i = 0; i < 40 && !(await st(pg)).backdrop; i++) await pg.waitForTimeout(150);
  s = await st(pg);
  eq([s.page, s.bodyMark, s.bodyGrad, s.backdrop, s.bdImg], ['backdrop', null, true, true, true], 'întuneric');
  await pg.evaluate(() => document.documentElement.setAttribute('data-mode', 'light'));
  for (let i = 0; i < 40 && (await st(pg)).backdrop; i++) await pg.waitForTimeout(150);
  s = await st(pg);
  eq([s.page, s.bodyMark, s.backdrop, s.bodyData], ['body', 'g', false, true], 'lumină din nou');
  await ctx.close();
});

await T('oprit/pornit din API: stratul și marcajul dispar, apoi revin', async () => {
  const {ctx, pg} = await open(page('body{background:' + GRAD + '}', CSP_OK));
  await pg.evaluate(() => window.FFF.texturi.set(false));
  let s = await st(pg);
  eq([s.backdrop, s.on, s.get], [false, false, false], 'oprit');
  await pg.evaluate(() => window.FFF.texturi.set(true));
  for (let i = 0; i < 40 && !(await st(pg)).backdrop; i++) await pg.waitForTimeout(150);
  s = await st(pg);
  eq([s.backdrop, s.on, s.get, s.bdImg], [true, true, true, true], 'pornit din nou');
  await ctx.close();
});

await T('CSP: img-src fără data: (sau default-src fără data:) → nu pornește, fără erori; cu data: pornește', async () => {
  const base = "script-src 'unsafe-inline'; style-src 'unsafe-inline'; ";
  for (const [csp, expectOn] of [["default-src 'none'; " + base + "img-src 'self'", false], ["default-src 'none'; " + base.trim(), false], ["default-src 'self' data:; " + base.trim(), true], ["default-src 'none'; " + base + "img-src 'self' data:", true]]) {
    const {ctx, pg, info} = await open(page('body{background:#f4f1ea}', csp));
    ok(info.on === expectOn, csp + ' → ' + JSON.stringify(info));
    if (!expectOn) eq(info.reason, 'csp-img-src', 'motiv');
    await ctx.close();
  }
});

await T('CSP prin antet (nevăzut din meta): o violare img-src data: oprește motorul fără să schimbe preferința', async () => {
  const {ctx, pg} = await open(page('body{background:#f4f1ea}', CSP_OK));
  await pg.evaluate(() => document.dispatchEvent(new SecurityPolicyViolationEvent('securitypolicyviolation', {violatedDirective: 'img-src', blockedURI: 'data'})));
  const r = await pg.evaluate(() => ({info: window.FFF.texturi.info(), get: window.FFF.texturi.get(), on: document.documentElement.hasAttribute('data-fffx-on'), pref: (() => { try { return localStorage.getItem('fff.texturi'); } catch (e) { return null; } })()}));
  eq([r.info.on, r.info.reason, r.get, r.on, r.pref], [false, 'csp-img-src', false, false, null], 'după violare');
  await ctx.close();
});

await browser.close();
const bad = results.filter((r) => !r[1]).length;
console.log('\n' + (results.length - bad) + '/' + results.length + ' teste trecute');
process.exit(bad ? 1 : 0);
