#!/usr/bin/env node
// tools/audit-adversarial.mjs — baterie generică de audit adversarial pentru o aplicație HTML single-file (kit fff), versiunea 4.8.
//   node tools/audit-adversarial.mjs <depozit> [--quick] [--root DIR] [--out DIR]
//   node tools/audit-adversarial.mjs --summary [DIR]      agregă rezultatele (JSON) dintr-un director: aplicații, constatări pe gravitate și pe cod
// Scrie <out>/<depozit>.json cu {app, findings:[{sev,code,msg}], stats:{...}}; --root = folderul cu clonele depozitelor (implicit: părintele hubului),
// --out = unde scrie (implicit: <tmp>/audit-adversarial). Variabile: AUDIT_ROOT, AUDIT_OUT, CHROMIUM_PATH (altfel Chromium-ul din Playwright),
// PW_ROOT / FFF_NODE_TOOLS = /cale/package.json în care e instalat `playwright`.
// Pași: încărcare (erori, cereri externe, încălcări CSP, stiluri neaplicate), 8 limbi (text brut, chei lipsă, netradus, mojibake), monkey-test cu
// intrări ostile, stocare coruptă / indisponibilă / plină, ceas schimbat + fusuri, viewporturi mici (inclusiv 320 px în fiecare limbă), ținte
// tactile, tastatură, bare fixe (acoperite de conținut; conținut rămas sub bara de jos), igienă statică (charset, ortografie, id-uri, ARIA). Fără rețea: cererile externe sunt blocate și raportate.
// Despre ce înseamnă o constatare și ce clase de fals pozitive există: docs/AUDIT-ADVERSARIAL-2026-11.md.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const SUMMARY = argv.includes('--summary');

function loadPlaywright() {
  const bases = [process.env.PW_ROOT, process.env.FFF_NODE_TOOLS, '/opt/node-tools/package.json', import.meta.url].filter(Boolean);
  for (const b of bases) { try { return createRequire(b)('playwright'); } catch (e) { /* următoarea bază */ } }
  console.error('Nu găsesc pachetul `playwright` (npm i -D playwright, sau PW_ROOT=/cale/package.json).'); process.exit(2);
}

const ROOT = path.resolve(opt('--root') || process.env.AUDIT_ROOT || path.join(HUB, '..'));
const OUT = path.resolve(opt('--out') || process.env.AUDIT_OUT || path.join(os.tmpdir(), 'audit-adversarial'));
const LANGS = ['ro', 'en', 'fr', 'it', 'es', 'pt', 'hu', 'de'];
const name = argv.filter((a, i) => !a.startsWith('--') && !['--root', '--out'].includes(argv[i - 1]))[0];
const QUICK = argv.includes('--quick');

if (SUMMARY) {   // agregare: node tools/audit-adversarial.mjs --summary [DIR]
  const dir = path.resolve(name || opt('--out') || process.env.AUDIT_OUT || path.join(os.tmpdir(), 'audit-adversarial'));
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : [];
  const bySev = {}, byCode = {}; let withF = 0, total = 0, secs = 0;
  for (const f of files) {
    let d; try { d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { continue; }
    const fs_ = d.findings || []; total += fs_.length; if (fs_.length) withF++; secs += (d.stats && d.stats.seconds) || 0;
    for (const x of fs_) { bySev[x.sev] = (bySev[x.sev] || 0) + 1; byCode[x.code] = (byCode[x.code] || 0) + 1; }
  }
  console.log(`${dir}: ${files.length} aplicații · ${withF} cu constatări · ${total} constatări ${JSON.stringify(bySev)} · ≈${(secs / 3600).toFixed(1)} h`);
  console.log(Object.entries(byCode).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(' · '));
  process.exit(0);
}
if (!name) { console.error('utilizare: node tools/audit-adversarial.mjs <depozit> [--quick] [--root DIR] [--out DIR]  |  --summary [DIR]'); process.exit(2); }
const {chromium} = loadPlaywright();
const dir = path.join(ROOT, name);
const file = path.join(dir, 'index.html');
if (!fs.existsSync(file)) { console.error('fără index.html:', name); process.exit(2); }
fs.mkdirSync(OUT, {recursive: true});

let EGRESS = [];
try { EGRESS = JSON.parse(fs.readFileSync(path.join(dir, 'app.json'), 'utf8')).egress || []; } catch (e) { /* fără app.json */ }
const hostOk = (u) => {
  let h, proto;
  try { const U = new URL(u); h = U.hostname; proto = U.protocol; } catch (e) { return true; }
  return EGRESS.some((e) => {
    const x = String(e && e.host || '');
    const m = x.match(/^(https?):\(/);
    if (m) return proto === m[1] + ':';
    const hh = x.replace(/:\d+$/, '');
    if (hh.startsWith('*.')) return h === hh.slice(2) || h.endsWith(hh.slice(1));
    return h === hh;
  });
};
const F = [];
const seen = new Set();
const add = (sev, code, msg, extra) => {
  const key = code + '|' + String(msg).slice(0, 120);
  if (seen.has(key)) return; seen.add(key);
  F.push({sev, code, msg: String(msg).slice(0, 400), ...(extra || {})});
};
const stats = {};
const T0 = Date.now();
const budget = (ms) => Date.now() - T0 < ms;

// zgomot specific mediului headless/file:// (nu e defect al aplicației)
const NOISE = [
  /Failed to load resource/i, /net::ERR_(FAILED|BLOCKED|INTERNET_DISCONNECTED|ABORTED|NAME_NOT_RESOLVED)/i,
  /ServiceWorker|service worker|Failed to register/i, /WebGL|GPU stall|swiftshader|GL Driver|GL_/i,
  /ResizeObserver loop/i, /favicon/i, /AudioContext|autoplay policy|user gesture|NotAllowedError|Permission denied|permission/i,
  /Permissions policy|feature policy/i, /\[Violation\]/i, /Refused to (load|connect|frame|apply)/i, /Content Security Policy/i,
  /Document is not focused|requestFullscreen|Fullscreen|PictureInPicture|SpeechSynthesis|speechSynthesis|getUserMedia|NotFoundError: Requested device/i,
  /navigator\.(share|clipboard)|Share canceled|AbortError/i, /showSaveFilePicker|showOpenFilePicker|File System Access/i,
  /Not allowed to load local resource/i, /window\.open|popup/i,
];
const isNoise = (m) => NOISE.some((r) => r.test(m));

// tipare de igienă a textului vizibil
const HYG = [
  ['hyg-undefined', /(^|[^\p{L}\p{N}_])(undefined|NaN|\[object Object\]|Infinity)([^\p{L}\p{N}_]|$)/u],
  ['hyg-placeholder', /\$\{|%[sd](?![\p{L}])|\{[0-9]\}|__[a-z_]+__|(^|[^\p{L}])(TODO|FIXME)([^\p{L}]|$)|[Ll]orem ipsum/u],
  ['hyg-mojibake', /Ã[\u0080-¿]|â€|Â[ -¿]|ï¿½|�|Ä[\u0083\u0081\u0082£\u009f]|Å[\u009f£\u009e]/],
  ['hyg-entity', /&(amp|lt|gt|quot|nbsp|#\d+);/],
  ['hyg-key', /^[a-z][a-z0-9]*(\.[a-z0-9_]+){1,4}$/],
  ['hyg-invdate', /Invalid Date|Date invalide|NaN[\/.-]NaN/],
];

const HYGMAP = new Map();
function textHygiene(lines, ctx) {
  const lang = (ctx.match(/^\[([a-z]{2}|monkey)\]/) || [])[1] || ctx;
  for (const t of lines) {
    for (const [code, re] of HYG) {
      if (!re.test(t)) continue;
      if (t.includes('${7*7}')) continue;                                                       // ecoul încărcăturii ostile tastate de «maimuță»
      if (code === 'hyg-undefined' && /Infinity/.test(t) && !/(^|[^\p{L}])(undefined|NaN|\[object Object\])([^\p{L}]|$)/u.test(t) && t.length > 25) continue;   // „Infinity” în proză (cosmologie, matematică)
      if (code === 'hyg-placeholder' && /^(es|pt)$/.test(lang) && !/\$\{|%[sd]|\{[0-9]\}|__[a-z_]+__|FIXME|[Ll]orem ipsum/.test(t)) continue;   // «TODO» = «tot/toate» în spaniolă și portugheză
      if (code === 'hyg-key' && (/\.(ro|com|org|net|io|ai|eu|dev|app|info|edu|gov|uk|de|fr|it|es|pt|hu|ru|me|tv|co|cc|xyz|online|tf|fm|js|css|html|json|md|txt|png|svg|jpg|webp|pdf|zip|wasm|mjs|guru|sh|link|garden|studio|int|tools|nu|live|si|wiki|run|pub|page|site|lol|fun|tech|zone|world|today|news|blog|club|city|team|chat|cloud|space|ly|so|to|is|im|gg|ws|pm|st|vc|cx|bz|ac|ag|am)$/i.test(t) || /^v?\d+(\.\d+)+/.test(t) || /^[a-z]+\.[a-z]+$/.test(t) && t.length < 12)) continue;
      const k = code + '|' + t.slice(0, 140);
      if (!HYGMAP.has(k)) HYGMAP.set(k, {code, t: t.slice(0, 140), langs: new Set(), attr: /attr/.test(ctx)});
      HYGMAP.get(k).langs.add(lang);
    }
  }
}
function flushHygiene() {
  for (const v of HYGMAP.values()) add('med', v.code, `«${v.t}» (${v.attr ? 'atribut, ' : ''}limbi: ${[...v.langs].join(',')})`);
}

async function openCtx(browser, o = {}) {
  const ctx = await browser.newContext({
    viewport: {width: o.w || 1280, height: o.h || 800}, colorScheme: o.scheme || 'light', reducedMotion: 'reduce',
    timezoneId: o.tz || 'Europe/Bucharest', locale: o.locale || 'ro-RO', acceptDownloads: true, serviceWorkers: 'block',
    hasTouch: !!o.touch, isMobile: !!o.touch,
  });
  const net = []; net.nav = new Set();   // nav: navigările documentului principal (utilizatorul pleacă spre alt site: nu e trafic al aplicației)
  let mainPage = null;
  // ferestrele deschise de utilizator (window.open / link _blank) sunt navigare, nu trafic al aplicației: nu se numără ca „egress”
  await ctx.route(/^https?:/, (r) => { let pg = null, noFrame = false; try { pg = r.request().frame().page(); } catch (e) { noFrame = true; /* prima cerere a unei ferestre noi: cadrul nu există încă */ } if (noFrame && r.request().isNavigationRequest()) { r.abort(); return; } try { const rq = r.request(); if (rq.isNavigationRequest() && mainPage && rq.frame() === mainPage.mainFrame()) net.nav.add(rq.url()); } catch (e) { /* ignorat */ } if (!(mainPage && pg && pg !== mainPage)) net.push(r.request().url()); r.abort(); });
  // încălcările CSP de stil/script (un <style> sau <script> blocat lasă pagina fără aspect ori fără cod); mesajele din consolă sunt filtrate ca zgomot, deci se citesc din eveniment
  await ctx.addInitScript(() => { window.__fffCsp = []; document.addEventListener('securitypolicyviolation', (e) => window.__fffCsp.push(e.violatedDirective + ' | ' + e.blockedURI)); });
  for (const s of o.init || []) await ctx.addInitScript(s.fn, s.arg);
  const page = await ctx.newPage();
  mainPage = page;
  const errs = [], dialogs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + String((e && e.message) || e).slice(0, 200) + ' ⟵ ' + String((e && e.stack) || '').split('\n').slice(1, 3).map((x) => x.trim().replace(/^at /, '').replace(/file:\/\/\/[^ ]*\//, '')).join(' | ').slice(0, 220)));
  page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!isNoise(t)) errs.push('console: ' + t.slice(0, 300)); } });
  page.on('dialog', (d) => { dialogs.push(d.type() + ':' + d.message().slice(0, 80)); d.dismiss().catch(() => {}); });
  page.on('popup', (p) => p.close().catch(() => {}));
  page.on('download', (d) => d.cancel().catch(() => {}));
  return {ctx, page, errs, net, dialogs};
}
const cleanErrs = (errs) => [...new Set(errs.filter((e) => !isNoise(e)))];

const GRAB = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'; };
  const lines = new Set();
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walk.nextNode())) {
    const t = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (t.length < 2) continue;
    const p = n.parentElement;
    if (!p || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(p.tagName) || !vis(p)) continue;
    lines.add(t);
  }
  const attrs = new Set();
  for (const el of document.querySelectorAll('[title],[aria-label],[placeholder],[alt]')) {
    if (!vis(el)) continue;
    for (const a of ['title', 'aria-label', 'placeholder', 'alt']) { const v = el.getAttribute(a); if (v && v.trim().length > 1) attrs.add(v.trim()); }
  }
  return {lines: [...lines], attrs: [...attrs], lang: document.documentElement.lang, title: document.title};
};

const DOMCHK = () => {
  const out = {ariaMissing: [], dupIds: [], deadAnchors: [], brokenImgs: [], labelMissing: []};
  const ids = new Map();
  for (const e of document.querySelectorAll('[id]')) { if (e.closest('template')) continue; ids.set(e.id, (ids.get(e.id) || 0) + 1); }
  for (const [k, n] of ids) if (n > 1) out.dupIds.push(k + '×' + n);
  for (const e of document.querySelectorAll('[aria-labelledby],[aria-describedby],[aria-controls],[aria-owns],[aria-activedescendant]')) {
    for (const at of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-activedescendant']) {
      const v = e.getAttribute(at); if (!v) continue;
      for (const t of v.split(/\s+/)) if (t && !document.getElementById(t)) out.ariaMissing.push(at.replace('aria-', '') + '=' + t);
    }
  }
  for (const l of document.querySelectorAll('label[for]')) if (!document.getElementById(l.getAttribute('for'))) out.labelMissing.push(l.getAttribute('for'));
  for (const a of document.querySelectorAll('a[href^="#"]')) {
    const h = a.getAttribute('href').slice(1);
    if (h && h !== 'top' && !document.getElementById(h) && !document.getElementsByName(h).length) out.deadAnchors.push('#' + h);
  }
  for (const i of document.querySelectorAll('img')) {
    if (i.closest('template')) continue;
    const src = i.getAttribute('src') || '';
    if (src && i.complete && i.naturalWidth === 0 && !/^https?:/.test(src)) out.brokenImgs.push(src.slice(0, 50));
  }
  for (const k of Object.keys(out)) out[k] = [...new Set(out[k])].slice(0, 8);
  return out;
};
const LAYOUT = () => {
  const de = document.documentElement;
  const clipped = [];
  for (const e of document.querySelectorAll('body *')) {
    if (clipped.length > 12) break;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) continue;
    if (!/^(hidden|clip)$/.test(cs.overflowX)) continue;
    if (cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none' && cs.webkitLineClamp) continue;
    if (e.scrollWidth > e.clientWidth + 2 && (e.textContent || '').trim().length > 2 && !e.querySelector('canvas,svg')) clipped.push((e.tagName + '.' + String(e.className).slice(0, 20) + ':' + (e.textContent || '').trim().slice(0, 24)));
  }
  return {sw: Math.max(de.scrollWidth, document.body.scrollWidth), cw: de.clientWidth, clipped};
};

// Bare fixe/lipicioase acoperite de conținut obișnuit (z-index lipsă): 5 puncte din bară, `elementFromPoint`. Se sar: fundaluri și văluri cât ecranul (> 60% din arie),
// straturi cu `pointer-events: none` sau cu `z-index` negativ (decor pus intenționat în spatele conținutului) și orice element aflat el însuși într-un strat fix (modal, alt panou). Fals pozitive: docs/AUDIT-ADVERSARIAL-2026-11.md § 6.
const FIXED_COVER = () => {
  const vw = innerWidth, vh = innerHeight, out = [];
  const fixedChain = (e) => { for (; e && e.nodeType === 1; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return e; } return null; };
  for (const bar of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(bar);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05 || cs.pointerEvents === 'none' || +cs.zIndex < 0) continue;   // z-index negativ: autorul l-a pus intenționat în spatele conținutului
    if (bar.checkVisibility && !bar.checkVisibility({checkOpacity: true, checkVisibilityCSS: true})) continue;
    const r = bar.getBoundingClientRect();
    const x0 = Math.max(0, r.left), x1 = Math.min(vw, r.right), y0 = Math.max(0, r.top), y1 = Math.min(vh, r.bottom);
    const area = (x1 - x0) * (y1 - y0);
    if (area < 2500 || (x1 - x0) < vw * 0.3 || area > vw * vh * 0.6) continue;
    let bad = 0, sample = '';
    for (const [fx, fy] of [[.5, .5], [.2, .5], [.8, .5], [.5, .2], [.5, .8]]) {
      const hit = document.elementFromPoint(x0 + (x1 - x0) * fx, y0 + (y1 - y0) * fy);
      if (!hit || bar.contains(hit) || hit === bar || fixedChain(hit) || hit.contains(bar)) continue;
      bad++; if (!sample) sample = hit.tagName + (typeof hit.className === 'string' && hit.className ? '.' + hit.className.split(' ')[0] : '') + ' «' + (hit.textContent || '').trim().slice(0, 30).replace(/\s+/g, ' ') + '»';
    }
    if (bad) out.push({bar: bar.tagName + (bar.id ? '#' + bar.id : '') + (typeof bar.className === 'string' && bar.className ? '.' + bar.className.split(' ')[0] : ''), z: cs.zIndex, bad, sample});
  }
  return out;
};

// Închide (cel mult de 3 ori) dialogul/ecranul de întâmpinare care acoperă pagina la prima pornire; întoarce true dacă a apăsat ceva.
const DISMISS_WELCOME = () => {
  const ds = [...document.querySelectorAll('[role=dialog],[aria-modal=true],dialog[open],[class*=welcome],[id*=welcome],[class*=overlay],[id*=Overlay]')].filter((d) => d.checkVisibility && d.checkVisibility() && d.getBoundingClientRect().height > innerHeight * 0.3);
  if (!ds.length) return false;
  const bts = ds.flatMap((d) => [...d.querySelectorAll('button,[role=button]')]).filter((x) => x.checkVisibility && x.checkVisibility());
  const good = bts.find((x) => /ok|accept|continu|încep|start|am în|understand|got it|închide|close|✕|×|skip|salt/i.test(x.textContent + ' ' + (x.getAttribute('aria-label') || ''))) || bts[bts.length - 1];
  if (!good) return false; good.click(); return true;
};

// Conținut care rămâne sub o bară fixă opacă de jos chiar și la derulare maximă (se măsoară marginea de jos a liniilor reale de text sau a elementelor media/control).
const UNDER_BAR = () => {
  const vw = innerWidth, vh = innerHeight;
  const fixedAnc = (e) => { for (; e && e.nodeType === 1; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return e; } return null; };
  const bars = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.5 || cs.pointerEvents === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.bottom < vh - 3 || r.height > vh * 0.4 || r.height < 12 || r.width < vw * 0.5) continue;
    const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/); const parts = m ? m[1].split(',') : []; const a = parts.length === 4 ? +parts[3] : (parts.length ? 1 : 0);
    if (a < 0.5 && cs.backdropFilter === 'none') continue;     // bară transparentă: conținutul se vede prin ea
    if (el.checkVisibility && !el.checkVisibility({checkOpacity: true, checkVisibilityCSS: true})) continue;
    bars.push({top: r.top, h: r.height});
  }
  if (!bars.length) return null;
  const barTop = Math.min(...bars.map((b) => b.top));
  let worst = null;
  const media = new Set(['IMG', 'SVG', 'CANVAS', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'A', 'VIDEO', 'LABEL']);
  // partea vizibilă a unui element e tăiată de strămoșii cu overflow (liste cu derulare proprie): ce a ieșit din ei nu e „sub bară”, ci ascuns de propriul container
  const clipOf = (el) => { let top = -Infinity, bottom = Infinity; for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) { if (/^(auto|scroll|hidden|clip)$/.test(getComputedStyle(a).overflowY)) { const q = a.getBoundingClientRect(); if (q.top > top) top = q.top; if (q.bottom < bottom) bottom = q.bottom; } } return {top, bottom}; };
  for (const el of document.body.querySelectorAll('*')) {
    if (fixedAnc(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.1) continue;
    if (el.checkVisibility && !el.checkVisibility({checkOpacity: true, checkVisibilityCSS: true})) continue;
    let own = ''; for (const n of el.childNodes) if (n.nodeType === 3) own += n.textContent;
    if (!own.trim() && !media.has(el.tagName)) continue;
    let r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
    if (!media.has(el.tagName) || el.tagName === 'LABEL') {
      let mb = -1; for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { const g = document.createRange(); g.selectNodeContents(n); for (const q of g.getClientRects()) if (q.height > 2 && q.bottom > mb) mb = q.bottom; }
      if (mb < 0) continue; r = {top: r.top, bottom: mb};
    }
    const cl = clipOf(el); r = {top: Math.max(r.top, cl.top), bottom: Math.min(r.bottom, cl.bottom)};
    if (r.bottom <= r.top + 2) continue;
    if (!worst || r.bottom > worst.bottom) worst = {bottom: r.bottom, el: el.tagName + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.split(' ')[0] : '') + ' «' + (own.trim() || el.getAttribute('aria-label') || el.value || '').slice(0, 24) + '»'};
  }
  if (worst && worst.bottom > barTop + 4) return {barH: Math.round(Math.max(...bars.map((b) => b.h))), under: Math.round(worst.bottom - barTop), el: worst.el, scrollable: document.documentElement.scrollHeight > vh + 2};
  return null;
};

const CLICKABLES = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
  const sel = 'button,[role=button],[role=tab],summary,a[href^="#"],input:not([type=hidden]),select,textarea,[onclick],label[for]';
  return [...document.querySelectorAll(sel)].filter((e) => !e.disabled && vis(e));
};

const FIND_LANG_BTN = (l) => {
  const codes = ['ro', 'en', 'fr', 'it', 'es', 'pt', 'hu', 'de'];
  const names = {
    ro: /^(rom[aâ]n[ăa]|romanian|roumain|rum[aä]nisch|rumano|romeno|rom[aá]n)$/i, en: /^(english|engleză|engleza|anglais|englisch|ingl[eé]s|inglese|angol)$/i,
    fr: /^(fran[cç]ais|french|franceză|franceza|franz[oö]sisch|franc[eé]s|francese|franc[eê]s|francia)$/i, it: /^(italiano|italian|italiană|italiana|italienisch|italien|olasz)$/i,
    es: /^(espa[nñ]ol|spanish|spaniolă|spaniola|spanisch|espagnol|spagnolo|spanyol)$/i, pt: /^(portugu[eê]s|portuguese|portugheză|portugheza|portugiesisch|portugais|portoghese|portug[aá]l)$/i,
    hu: /^(magyar|hungarian|maghiară|maghiara|ungarisch|hongrois|ungherese|h[uú]ngaro)$/i, de: /^(deutsch|german|germană|germana|allemand|alem[aá]n|tedesco|alem[aã]o|n[eé]met)$/i,
  };
  const norm = (t) => t.replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}☀-➿]/gu, '').replace(/[^\p{L}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const map = {};
  for (const e of document.querySelectorAll('button,a,[role=tab],[role=button],[role=menuitem],[role=option],li,span,div,label')) {
    if (e.children.length > 2) continue;
    const r = e.getBoundingClientRect(); if (r.width < 6 || r.height < 6) continue;
    const t = norm(e.textContent || ''); if (!t || t.length > 14) continue;
    const clickable = e.matches('button,a,[role=tab],[role=button],[role=menuitem],[role=option],label') || getComputedStyle(e).cursor === 'pointer' || typeof e.onclick === 'function';
    if (!clickable) continue;
    let code = null; const tl = t.toLowerCase();
    if (codes.includes(tl)) code = tl; else for (const c of codes) if (names[c].test(t)) { code = c; break; }
    if (!code) { const a = String(e.getAttribute('lang') || (e.dataset && (e.dataset.lang || e.dataset.l || e.dataset.code)) || e.value || '').toLowerCase().slice(0, 2); if (codes.includes(a)) code = a; }
    if (code && !map[code]) map[code] = e;
  }
  if (Object.keys(map).length >= 5 && map[l]) { map[l].click(); return 'buttons'; }
  return null;
};

async function switchLang(page, l) {
  const snap = () => page.evaluate(() => document.body.innerText.length + ':' + document.body.innerText.slice(0, 600));
  const before = await snap();
  const tries = [
    () => page.evaluate((l) => {
      for (const s of document.querySelectorAll('select')) {
        const vals = [...s.options].map((o) => o.value.toLowerCase());
        if (vals.includes(l) && vals.filter((v) => /^(ro|en|fr|it|es|pt|hu|de)$/.test(v)).length >= 4) {
          s.value = [...s.options].find((o) => o.value.toLowerCase() === l).value;
          s.dispatchEvent(new Event('input', {bubbles: true})); s.dispatchEvent(new Event('change', {bubbles: true})); return 'select';
        }
      }
      return null;
    }, l),
    () => page.evaluate((l) => {      // <select> ale cărui opțiuni au valori numerice/arbitrare, dar text = numele limbii
      const names = {
        ro: /^(rom[aâ]n[ăa]|romanian|roumain|rum[aä]nisch|rumano|romeno|rom[aá]n)$/i, en: /^(english|engleză|engleza|anglais|englisch|ingl[eé]s|inglese|angol)$/i,
        fr: /^(fran[cç]ais|french|franceză|franceza|franz[oö]sisch|franc[eé]s|francese|franc[eê]s|francia)$/i, it: /^(italiano|italian|italiană|italiana|italienisch|italien|olasz)$/i,
        es: /^(espa[nñ]ol|spanish|spaniolă|spaniola|spanisch|espagnol|spagnolo|spanyol)$/i, pt: /^(portugu[eê]s|portuguese|portugheză|portugheza|portugiesisch|portugais|portoghese|portug[aá]l)$/i,
        hu: /^(magyar|hungarian|maghiară|maghiara|ungarisch|hongrois|ungherese|h[uú]ngaro)$/i, de: /^(deutsch|german|germană|germana|allemand|alem[aá]n|tedesco|alem[aã]o|n[eé]met)$/i,
      };
      const codes = Object.keys(names);
      const norm = (t) => t.replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}☀-➿]/gu, '').replace(/[^\p{L}]+/gu, ' ').replace(/\s+/g, ' ').trim();
      for (const s of document.querySelectorAll('select')) {
        const map = {};
        for (const o of s.options) { const t = norm(o.textContent || ''); const tl = t.toLowerCase(); let c = codes.includes(tl) ? tl : null; if (!c) for (const k of codes) if (names[k].test(t)) { c = k; break; } if (c && !map[c]) map[c] = o; }
        if (Object.keys(map).length >= 5 && map[l]) { s.value = map[l].value; s.dispatchEvent(new Event('input', {bubbles: true})); s.dispatchEvent(new Event('change', {bubbles: true})); return 'select-text'; }
      }
      return null;
    }, l),
    () => page.evaluate(FIND_LANG_BTN, l),
    () => page.evaluate((l) => {
      const el = document.querySelector(`[data-lang="${l}"],[data-l="${l}"],button[lang="${l}"],[data-set-lang="${l}"]`);
      if (el) { el.click(); return 'data-lang'; } return null;
    }, l),
    () => page.evaluate((l) => { document.documentElement.setAttribute('lang', l); return 'html-lang'; }, l),
    () => page.evaluate((l) => {
      for (const fn of ['setLang', 'setLanguage', 'changeLang', 'switchLang', 'setL', 'chLang', 'langSet']) {
        if (typeof window[fn] === 'function') { try { window[fn](l); return 'fn:' + fn; } catch (e) { /* următorul */ } }
      }
      return null;
    }, l),
  ];
  let used = null;
  for (const t of tries) {
    let r = null;
    try { r = await t(); } catch (e) { r = null; }
    if (!r) continue;
    await page.waitForTimeout(250);
    const after = await snap();
    used = r;
    if (after !== before || l === 'ro') return {how: r, changed: after !== before};
  }
  return {how: used, changed: false};
}

const ADV = ['', ' ', '0', '-1', '1e309', '99999999999999999999', '😀'.repeat(40), 'א'.repeat(30) + 'abc', '<img src=x onerror=alert(1)>', '"\'`${7*7}{{7*7}}',
  'a'.repeat(20000), '\u0000‮​', '../../etc/passwd', 'Ana are mere', '0.1', '-0', '2147483648', '٣٤٥', 'ǅ ǈ ǋ ß İ ı', '\n\n\n'];

async function monkey(page, steps, rnd) {
  let done = 0;
  for (let i = 0; i < steps && budget(110000); i++) {
    const handles = await page.evaluateHandle(CLICKABLES);
    const n = await page.evaluate((a) => a.length, handles);
    if (!n) { await handles.dispose(); break; }
    const k = Math.floor(rnd() * n);
    const el = await page.evaluateHandle(([a, k]) => a[k], [handles, k]);
    try {
      const info = await el.evaluate((e) => ({t: e.tagName, ty: (e.type || '').toLowerCase(), href: e.getAttribute('href') || '', multi: !!e.multiple}));
      if (info.t === 'A' && info.href && !info.href.startsWith('#')) { /* nu navigăm în afară */ }
      else if (info.t === 'SELECT') {
        const opts = await el.evaluate((e) => [...e.options].map((o) => o.value));
        if (opts.length) await el.selectOption(opts[Math.floor(rnd() * opts.length)], {timeout: 800});
      } else if (info.t === 'INPUT' || info.t === 'TEXTAREA') {
        if (['checkbox', 'radio'].includes(info.ty)) await el.click({timeout: 800, force: true});
        else if (info.ty === 'range') await el.evaluate((e, r) => { const mn = +e.min || 0, mx = +e.max || 100; e.value = [mn, mx, mn - 1, mx + 1, (mn + mx) / 2][Math.floor(r * 5)]; e.dispatchEvent(new Event('input', {bubbles: true})); e.dispatchEvent(new Event('change', {bubbles: true})); }, rnd());
        else if (info.ty === 'date') await el.fill(['0001-01-01', '9999-12-31', '2028-02-29', '1970-01-01', '2038-01-19'][Math.floor(rnd() * 5)], {timeout: 800});
        else if (info.ty === 'time') await el.fill(['00:00', '23:59', '12:30'][Math.floor(rnd() * 3)], {timeout: 800});
        else if (info.ty === 'datetime-local') await el.fill('2028-02-29T23:59', {timeout: 800});
        else if (info.ty === 'color') await el.fill('#ff00aa', {timeout: 800});
        else if (['file', 'button', 'submit', 'reset', 'image'].includes(info.ty)) await el.click({timeout: 800, force: true});
        else {
          let v = ADV[Math.floor(rnd() * ADV.length)];
          if (info.ty === 'number') v = ['0', '-1', '1e308', '-0', '0.1', '99999999999', '', '1e-9', '2147483648', '3.14159'][Math.floor(rnd() * 10)];
          if (info.ty === 'email') v = ['a@b.c', '@@', 'a'.repeat(300) + '@x.y', ''][Math.floor(rnd() * 4)];
          await el.fill(v, {timeout: 800});
          if (rnd() < 0.5) await el.press('Enter', {timeout: 800});
        }
      } else {
        await el.click({timeout: 800, force: rnd() < 0.3});
      }
      done++;
    } catch (e) { /* element dispărut/obstrucționat: normal */ }
    await handles.dispose().catch(() => {});
    await page.waitForTimeout(60);
    if (rnd() < 0.08) { try { await page.keyboard.press(['Escape', 'Enter', 'Space', 'ArrowDown', 'ArrowUp', 'Tab', 'Backspace', 'Home', 'End'][Math.floor(rnd() * 9)]); } catch (e) { /* ok */ } }
  }
  return done;
}

function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

(async () => {
  const html = fs.readFileSync(file, 'utf8');
  stats.kb = Math.round(html.length / 1024);
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
  const url = 'file://' + file;
  let baseErrs = [];
  let baseLen = 0;
  try {
    // S1 — încărcare
    {
      const {ctx, page, errs, net, dialogs} = await openCtx(browser);
      const t = Date.now();
      try { await page.goto(url, {waitUntil: 'load', timeout: 30000}); } catch (e) { add('high', 'load-fail', e.message); }
      stats.loadMs = Date.now() - t;
      await page.waitForTimeout(1200);
      baseErrs = cleanErrs(errs);
      for (const e of baseErrs) add('high', 'load-error', e);
      for (const u of [...new Set(net)].filter((u) => !hostOk(u)).slice(0, 5)) add('high', 'undeclared-egress-load', u + ' (nedeclarat în app.json › egress)');
      stats.egressAtLoad = [...new Set(net)].length;
      baseLen = await page.evaluate(() => document.body.innerText.length).catch(() => 0);
      stats.textLen = baseLen;
      {
        const cs = await page.evaluate(() => ({v: window.__fffCsp || [], unapplied: [...document.querySelectorAll('style')].filter((x) => x.textContent.trim() && !x.sheet).length})).catch(() => ({v: [], unapplied: 0}));
        const bad = [...new Set(cs.v)].filter((x) => /^(style|script)-src/.test(x));
        if (bad.length) add('high', 'csp-blocked', 'CSP blochează cod/stil al paginii: ' + bad.slice(0, 4).join('; ') + (cs.unapplied ? ` (${cs.unapplied} bloc(uri) <style> neaplicate)` : ''));
        else if (cs.unapplied) add('high', 'csp-blocked', `${cs.unapplied} bloc(uri) <style> neaplicate`);
        stats.cspViolations = bad.length;
      }
      if (baseLen < 40) add('high', 'blank-page', `text vizibil ${baseLen} caractere`);
      if (stats.loadMs > 4000) add('low', 'slow-load', stats.loadMs + ' ms');
      const heap = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null)).catch(() => null);
      stats.heapMB = heap;
      if (heap && heap > 200) add('low', 'heavy-heap', heap + ' MB după încărcare');
      if (dialogs.length) add('low', 'dialog-on-load', dialogs.join(' | '));
      try {
        const dc = await page.evaluate(DOMCHK);
        if (dc.ariaMissing.length) add('med', 'aria-ref-missing', `referințe aria către id-uri inexistente (la încărcare): ${dc.ariaMissing.join(', ')}`);
        if (dc.dupIds.length) add('med', 'dup-id-runtime', `id-uri duplicate: ${dc.dupIds.join(', ')}`);
        if (dc.deadAnchors.length) add('low', 'dead-anchor', `ancore fără țintă: ${dc.deadAnchors.join(', ')}`);
        if (dc.brokenImgs.length) add('med', 'broken-image', `imagini nefuncționale: ${dc.brokenImgs.join(', ')}`);
        if (dc.labelMissing.length) add('med', 'label-for-missing', `label[for] fără câmp: ${dc.labelMissing.join(', ')}`);
      } catch (e) { /* ok */ }
      // tastatură: parcurs cu Tab
      try {
        const seenF = new Set(); let lastKey = '';
        for (let i = 0; i < 40; i++) {
          await page.keyboard.press('Tab');
          const k = await page.evaluate(() => { const a = document.activeElement; return a ? (a.tagName + '#' + (a.id || '') + '.' + String(a.className).slice(0, 30) + '|' + (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 20)) : 'none'; });
          seenF.add(k); lastKey = k;
        }
        const nClick = await page.evaluate(() => document.querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])').length);
        stats.tabUnique = seenF.size; stats.interactive = nClick;
        if (nClick >= 6 && seenF.size <= 2) add('med', 'keyboard-trap', `Tab: ${seenF.size} elemente distincte din ${nClick} interactive`);
      } catch (e) { /* ok */ }
      // ținte tactile mici (WCAG 2.2: 24×24)
      try {
        const small = await page.evaluate(() => {
          const out = [];
          for (const e of document.querySelectorAll('button,[role=button],input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,summary')) {
            const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
            if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none') continue;
            if (r.width < 24 || r.height < 24) out.push((e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 20) + ` ${Math.round(r.width)}×${Math.round(r.height)}`);
          }
          return out;
        });
        stats.smallTargets = small.length;
        if (small.length > 4) add('low', 'small-targets', `${small.length} ținte < 24×24 px, ex.: ${small.slice(0, 4).join('; ')}`);
      } catch (e) { /* ok */ }
      await ctx.close();
    }

    // S2 — limbi
    if (budget(200000)) {
      const {ctx, page, errs} = await openCtx(browser);
      await page.goto(url, {waitUntil: 'load', timeout: 30000}).catch(() => {});
      await page.waitForTimeout(600);
      const snaps = {};
      const how = {};
      for (const l of LANGS) {
        const sw = await switchLang(page, l);
        how[l] = sw;
        await page.waitForTimeout(250);
        sw.attr = await page.evaluate(() => (document.documentElement.lang || '').slice(0, 2).toLowerCase()).catch(() => '');
        const s = [];
        s.push(await page.evaluate(GRAB));
        // parcurs determinist: primele 6 elemente de navigare
        for (let k = 0; k < 4; k++) {
          try {
            const handles = await page.evaluateHandle(CLICKABLES);
            const nav = await page.evaluateHandle((a) => {
              const isLC = (e) => { const t = (e.textContent || '').replace(/[^\p{L}]+/gu, ' ').trim().toLowerCase(); return /^(ro|en|fr|it|es|pt|hu|de)$/.test(t) || /^(romana|română|english|français|francais|italiano|español|espanol|português|portugues|magyar|deutsch)$/.test(t) || !!e.closest('[class*="lang" i],[id*="lang" i],[aria-label*="Limb" i],[aria-label*="Language" i],[aria-label*="Langue" i]'); };
              return a.filter((e) => (/^(BUTTON|SUMMARY)$/.test(e.tagName) || e.getAttribute('role') === 'tab' || e.tagName === 'A') && !isLC(e));
            }, handles);
            const cnt = await page.evaluate((a) => a.length, nav);
            if (k >= cnt) { await handles.dispose(); await nav.dispose(); break; }
            const el = await page.evaluateHandle(([a, k]) => a[k], [nav, k]);
            await el.click({timeout: 800, force: true}).catch(() => {});
            await handles.dispose(); await nav.dispose();
            await page.waitForTimeout(150);
            s.push(await page.evaluate(GRAB));
          } catch (e) { break; }
        }
        snaps[l] = s;
        // revenire la starea inițială pentru următoarea limbă
        await page.reload({waitUntil: 'load'}).catch(() => {});
        await page.waitForTimeout(300);
        if (!budget(200000)) break;
      }
      for (const e of cleanErrs(errs)) if (!baseErrs.includes(e)) add('high', 'lang-error', e);
      const swOk = LANGS.filter((l) => how[l] && how[l].changed).length;
      stats.langSwitchable = swOk;
      stats.langHow = [...new Set(Object.values(how).map((h) => h && h.how))].join(',');
      const uiHow = LANGS.filter((l) => how[l] && /^(select|buttons|data-lang)$/.test(how[l].how));
      const attrBad = uiHow.filter((l) => how[l].changed && how[l].attr !== l);
      stats.htmlLangMismatch = attrBad.length;
      if (attrBad.length >= 2) add('med', 'html-lang-not-synced', `după schimbarea limbii din interfață, <html lang> rămâne greșit pentru ${attrBad.length} limbi (ex.: ${attrBad.slice(0, 3).map((l) => l + '→' + how[l].attr).join(', ')}); modulele kitului și cititoarele de ecran se iau după el`);
      if (swOk < 4) add('med', 'lang-switch-undetected', `schimbarea limbii a modificat textul doar în ${swOk}/8 limbi (mecanism: ${stats.langHow || 'niciunul'})`);
      for (const l of LANGS) for (const sn of snaps[l] || []) { textHygiene(sn.lines, `[${l}]`); textHygiene(sn.attrs, `[${l}] attr`); }
      { const ced = new Set(); for (const sn of snaps.ro || []) for (const t of sn.lines) if (/[şţŞŢ]/.test(t)) ced.add(t.slice(0, 60)); if (ced.size) add('low', 'ro-cedilla', `${ced.size} linii românești cu ş/ţ (sedilă) în loc de ș/ț, ex.: ${[...ced].slice(0, 2).join(' ¦ ')}`); }
      // netradus (metrică de „scurgere”): linii care diferă între ro și en (deci traductibile) și apar neschimbate în altă limbă
      const prose = (t) => (t.match(/[\p{L}]{3,}/gu) || []).length >= 2 && !/[\/_@]|https?:|\.\w{2,4}\b/.test(t) && t.length <= 180;
      const allLines = (l) => { const o = new Set(); for (const sn of snaps[l] || []) for (const t of sn.lines) if (prose(t)) o.add(t); return o; };
      const roS = allLines('ro'), enS = allLines('en');
      const TLen = [...enS].filter((t) => !roS.has(t)), TLro = [...roS].filter((t) => !enS.has(t));
      stats.proseRo = roS.size; stats.translatableEn = TLen.length; stats.translatableRo = TLro.length;
      if (Math.min(TLen.length, TLro.length) >= 8) {
        for (const l of ['fr', 'it', 'es', 'pt', 'hu', 'de']) {
          const L = allLines(l);
          const lkEn = TLen.filter((t) => L.has(t)), lkRo = TLro.filter((t) => L.has(t));
          const ratio = (lkEn.length + lkRo.length) / (TLen.length + TLro.length);
          stats['leak_' + l] = Math.round(ratio * 100);
          if (ratio >= 0.25) add(ratio >= 0.6 ? 'high' : 'med', 'untranslated', `[${l}] ${Math.round(ratio * 100)}% din ${TLen.length + TLro.length} linii traductibile rămân în ro/en (ro:${lkRo.length}, en:${lkEn.length}), ex.: ${[...lkRo, ...lkEn].slice(0, 4).map((t) => t.slice(0, 44)).join(' ¦ ')}`);
        }
      } else if (roS.size >= 25 && TLen.length < 8) {
        add('med', 'ro-en-identical', `română și engleza dau aproape aceleași ${roS.size} linii de text (doar ${Math.min(TLen.length, TLro.length)} diferă): comutarea nu are efect sau una dintre limbi nu e tradusă`);
      }
      await ctx.close();
    }

    // S3 — monkey (limba implicită), apoi citire chei de stocare
    let keys = [];
    if (budget(240000)) {
      const {ctx, page, errs, net, dialogs} = await openCtx(browser);
      await page.goto(url, {waitUntil: 'load', timeout: 30000}).catch(() => {});
      await page.waitForTimeout(500);
      const rnd = mulberry(20261119);
      const steps = QUICK ? 25 : 70;
      stats.monkeySteps = await monkey(page, steps, rnd);
      for (const e of cleanErrs(errs)) if (!baseErrs.includes(e)) add('high', 'monkey-error', e);
      for (const u of [...new Set(net)].filter((u) => !hostOk(u) && !(net.nav && net.nav.has(u))).slice(0, 5)) add('high', 'undeclared-egress', u + ' (nedeclarat în app.json › egress)');
      for (const d of dialogs) if (/^alert:1$/.test(d) || /alert:(1|XSS|xss)/.test(d)) add('high', 'xss-executed', 'payload-ul <img onerror=alert(1)> s-a executat: ' + d);
      const g = await page.evaluate(GRAB).catch(() => ({lines: [], attrs: []}));
      textHygiene(g.lines, '[monkey]'); textHygiene(g.attrs, '[monkey] attr');
      try {
        const dc = await page.evaluate(DOMCHK);
        if (dc.ariaMissing.length) add('med', 'aria-ref-missing', `referințe aria către id-uri inexistente (după acțiuni): ${dc.ariaMissing.join(', ')}`);
        if (dc.dupIds.length) add('med', 'dup-id-runtime', `id-uri duplicate: ${dc.dupIds.join(', ')}`);
        if (dc.brokenImgs.length) add('med', 'broken-image', `imagini nefuncționale: ${dc.brokenImgs.join(', ')}`);
      } catch (e) { /* ok */ }
      keys = await page.evaluate(() => { try { return Object.keys(localStorage); } catch (e) { return []; } }).catch(() => []);
      stats.storageKeys = keys.length;
      const endLen = await page.evaluate(() => document.body.innerText.length).catch(() => -1);
      if (endLen === 0) add('high', 'blank-after-monkey', 'pagina a rămas fără text după acțiuni ostile');
      await ctx.close();
    }

    // S4 — stocare coruptă / indisponibilă
    if (budget(300000)) {
      const payloads = QUICK ? ['{"', 'null'] : ['{"', 'null', '[]', '{"a":1}', '9'.repeat(100000)];
      const keyList = keys.length ? keys : [];
      const variants = [];
      if (keyList.length) for (const p of payloads) variants.push({id: 'corupt:' + (p.length > 20 ? 'mare' : p), init: [{fn: ({k, p}) => { try { for (const x of k) localStorage.setItem(x, p); } catch (e) {} }, arg: {k: keyList, p}}]});
      variants.push({id: 'localStorage-aruncă', init: [{fn: () => { Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('denied', 'SecurityError'); }}); }, arg: null}]});
      variants.push({id: 'setItem-quota', init: [{fn: () => { Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; }, arg: null}]});
      variants.push({id: 'fără-indexedDB', init: [{fn: () => { try { Object.defineProperty(window, 'indexedDB', {get() { return undefined; }}); } catch (e) {} }, arg: null}]});
      for (const v of variants) {
        if (!budget(300000)) break;
        const {ctx, page, errs} = await openCtx(browser, {init: v.init});
        await page.goto(url, {waitUntil: 'load', timeout: 30000}).catch(() => {});
        await page.waitForTimeout(700);
        try { await monkey(page, 8, mulberry(7)); } catch (e) { /* ok */ }
        const len = await page.evaluate(() => document.body.innerText.length).catch(() => -1);
        const newErrs = cleanErrs(errs).filter((e) => !baseErrs.includes(e));
        for (const e of newErrs.slice(0, 3)) add('high', 'storage-' + v.id.split(':')[0], `[${v.id}] ${e}`);
        if (len >= 0 && len < 20 && baseLen > 100) add('high', 'storage-blank', `[${v.id}] pagina rămâne fără text (${len} caractere față de ${baseLen})`);
        await ctx.close();
      }
    }

    // S5 — ceas și fusuri
    if (budget(360000)) {
      const clocks = QUICK ? [['1970-01-01T00:00:00Z', 'UTC'], ['2027-12-31T23:59:50+14:00', 'Pacific/Kiritimati']] : [
        ['1970-01-01T00:00:00Z', 'UTC'], ['2038-01-19T03:14:08Z', 'UTC'], ['2100-03-01T12:00:00Z', 'UTC'],
        ['2027-12-31T23:59:50+14:00', 'Pacific/Kiritimati'], ['2027-03-28T00:59:50Z', 'Europe/Bucharest'], ['2026-06-11T19:00:00Z', 'America/Mexico_City'],
      ];
      for (const [time, tz] of clocks) {
        if (!budget(360000)) break;
        const {ctx, page, errs} = await openCtx(browser, {tz});
        try { await page.clock.setFixedTime(new Date(time)); } catch (e) { /* ok */ }
        await page.goto(url, {waitUntil: 'load', timeout: 30000}).catch(() => {});
        await page.waitForTimeout(800);
        try { await monkey(page, 6, mulberry(11)); } catch (e) { /* ok */ }
        const g = await page.evaluate(GRAB).catch(() => ({lines: [], attrs: []}));
        const bad = g.lines.filter((t) => /Invalid Date|Date invalide|\bNaN\b|undefined|Infinity|\[object /.test(t));
        for (const t of bad.slice(0, 3)) add('high', 'clock-text', `[${time} ${tz}] «${t.slice(0, 120)}»`);
        for (const e of cleanErrs(errs).filter((e) => !baseErrs.includes(e)).slice(0, 3)) add('high', 'clock-error', `[${time} ${tz}] ${e}`);
        await ctx.close();
      }
    }

    // S5b — setări regionale diferite (virgulă/punct zecimal, formate de dată)
    if (budget(425000)) {
      for (const loc of QUICK ? ['de-DE'] : ['en-US', 'de-DE', 'hu-HU']) {
        if (!budget(425000)) break;
        const {ctx, page, errs} = await openCtx(browser, {locale: loc, tz: 'UTC'});
        await page.goto(url, {waitUntil: 'load', timeout: 30000}).catch(() => {});
        await page.waitForTimeout(600);
        try { await monkey(page, 14, mulberry(31)); } catch (e) { /* ok */ }
        const g = await page.evaluate(GRAB).catch(() => ({lines: [], attrs: []}));
        const bad = g.lines.filter((t) => /Invalid Date|Date invalide|(^|[^\p{L}])(NaN|undefined|Infinity)([^\p{L}]|$)|\[object /u.test(t));
        for (const t of bad.slice(0, 2)) add('high', 'locale-text', `[${loc}] «${t.slice(0, 120)}»`);
        for (const e of cleanErrs(errs).filter((e) => !baseErrs.includes(e)).slice(0, 2)) add('high', 'locale-error', `[${loc}] ${e}`);
        await ctx.close();
      }
    }

    // S6b — aspect la 320 px în fiecare limbă (cuvinte lungi: de/hu/fr)
    if (budget(430000)) {
      const {ctx, page, errs} = await openCtx(browser, {w: 320, h: 568});
      await page.goto(url, {waitUntil: 'load', timeout: 30000}).catch(() => {});
      await page.waitForTimeout(500);
      const res = {};
      for (const l of LANGS) {
        const sw = await switchLang(page, l).catch(() => null);
        await page.waitForTimeout(250);
        res[l] = await page.evaluate(LAYOUT).catch(() => null);
        if (!budget(430000)) break;
      }
      const base = res.ro || res.en;
      for (const l of LANGS) {
        const r = res[l]; if (!r) continue;
        if (r.sw > r.cw + 3 && !(base && base.sw > base.cw + 3)) add('med', 'h-overflow-lang', `[${l}] 320 px: derulare orizontală doar în această limbă (${r.sw} > ${r.cw})`);
        const bc = base ? base.clipped.length : 0;
        if (r.clipped.length > bc) add('low', 'clipped-text-lang', `[${l}] 320 px: ${r.clipped.length} elemente cu text tăiat (față de ${bc} în română), ex.: ${r.clipped.slice(0, 3).join(' ¦ ')}`);
      }
      stats.layoutLangs = Object.keys(res).length;
      await ctx.close();
    }

    // S6 — viewporturi mici
    if (budget(400000)) {
      for (const [w, h, tch] of [[320, 568, false], [360, 640, true], [568, 320, false], [1920, 400, false]]) {
        const {ctx, page, errs} = await openCtx(browser, {w, h, touch: tch});
        await page.goto(url, {waitUntil: 'load', timeout: 30000}).catch(() => {});
        await page.waitForTimeout(600);
        const ov = await page.evaluate(() => { const de = document.documentElement; return {sw: Math.max(de.scrollWidth, document.body.scrollWidth), cw: de.clientWidth}; }).catch(() => null);
        if (ov && ov.sw > ov.cw + 3) add('med', 'h-overflow', `${w}×${h}${tch ? ' (mobil)' : ''}: derulare orizontală (${ov.sw} > ${ov.cw})`);
        for (const e of cleanErrs(errs).filter((e) => !baseErrs.includes(e)).slice(0, 2)) add('high', 'viewport-error', `${w}×${h} ${e}`);
        await ctx.close();
      }
    }

    // S7 — bare fixe: acoperite de conținut (z-index lipsă) și conținut rămas sub bara de jos (320×640 și 1280×800)
    if (budget(420000)) {
      for (const [w, h] of [[320, 640], [1280, 800]]) {
        const {ctx, page} = await openCtx(browser, {w, h});
        await page.goto(url, {waitUntil: 'load', timeout: 30000}).catch(() => {});
        await page.waitForTimeout(600);
        for (let k = 0; k < 3; k++) { if (!(await page.evaluate(DISMISS_WELCOME).catch(() => false))) break; await page.waitForTimeout(350); }
        for (const frac of [0, 0.5]) {
          if (frac) { await page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), frac).catch(() => {}); await page.waitForTimeout(250); }
          for (const c of (await page.evaluate(FIXED_COVER).catch(() => [])).slice(0, 3)) add('med', 'fixed-covered', `${w}×${h}: bara fixă ${c.bar} (z-index ${c.z}) e acoperită de ${c.sample} în ${c.bad} din 5 puncte`);
        }
        await page.evaluate(() => window.scrollTo(0, 1e7)).catch(() => {}); await page.waitForTimeout(300);
        const u = await page.evaluate(UNDER_BAR).catch(() => null);
        if (u) add('med', 'under-bar', `${w}×${h}: la derulare maximă ${u.el} rămâne cu ${u.under} px sub bara fixă de jos (bară de ${u.barH} px${u.scrollable ? '' : '; pagina nu derulează'})`);
        await ctx.close();
      }
    }
  } catch (e) {
    add('high', 'harness-crash', String(e && e.stack || e).slice(0, 300));
  } finally {
    await browser.close().catch(() => {});
  }
  flushHygiene();
  stats.v = 4.8;
  stats.seconds = Math.round((Date.now() - T0) / 1000);
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify({app: name, findings: F, stats}, null, 1));
  console.log(`${name}: ${F.length} constatări (${F.filter((f) => f.sev === 'high').length} grave) în ${stats.seconds}s`);
})();
