#!/usr/bin/env node
// fff-kit · build — injectează modulele kitului în index.html (idempotent), verifică, produce descriptorul de transparență.
// Fără dependențe externe (doar module Node + lib/csp.mjs). Playwright doar pentru `info --probe`.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {recomputeCspHashes, checkCspHashes, cspMeta, inlineScripts, sha256b64} from './lib/csp.mjs';

const KIT = path.dirname(fileURLToPath(import.meta.url));
const ORDER = ['core', 'label', 'bundle', 'qr', 'p2p', 'srs', 'tts', 'pii', 'search', 'ephem', 'ephem-stars'];
const BLOCK_RE = /\n<!--fff:kit:start[^>]*-->[\s\S]*?<!--fff:kit:end-->/;
const INFO_RE = /\n<!--fff:info:start-->[\s\S]*?<!--fff:info:end-->/;
const FORMAT_V = 1;

/* ---------------- utilitare ---------------- */
const sha256hex = (s) => createHash('sha256').update(s).digest('hex');
const rd = (p) => fs.readFileSync(path.join(KIT, p), 'utf8');
function kitVersion() { const m = rd('src/core.js').match(/KIT_VERSION\s*=\s*'([^']+)'/); return m ? m[1] : '0.0.0'; }

function resolveTarget(dir) {
  const p = path.resolve(dir);
  if (!fs.existsSync(p)) throw new Error(`nu există: ${dir}`);
  if (fs.statSync(p).isFile()) return {file: p, dir: path.dirname(p)};
  const f = path.join(p, 'index.html');
  if (!fs.existsSync(f)) throw new Error(`lipsește ${f}`);
  return {file: f, dir: p};
}
function readHtml(file) {
  const buf = fs.readFileSync(file);
  const s = buf.toString('utf8');
  if (!Buffer.from(s, 'utf8').equals(buf)) throw new Error(`${file}: nu este UTF-8 valid (refuz să-l rescriu)`);
  return s;
}
function writeIfChanged(file, s) {
  const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (old !== s) fs.writeFileSync(file, s);
  return old !== s;
}
function parseArgs(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (['slug', 'modules', 'disable'].includes(k)) opt[k] = argv[++i];
      else opt[k] = true;
    } else pos.push(a);
  }
  return {pos, opt};
}
function escJsonForHtml(s) { return s.replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'); }
function metaContent(html, name) {
  const re = new RegExp(`<meta\\b[^>]*\\bname=["']${name}["'][^>]*>`, 'i');
  const m = html.match(re); if (!m) return '';
  const c = m[0].match(/\bcontent=("([^"]*)"|'([^']*)')/i);
  return c ? (c[2] ?? c[3]) : '';
}
function decodeEntities(s) {
  return s.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => {
    const l = e.toLowerCase();
    if (l === 'amp') return '&'; if (l === 'lt') return '<'; if (l === 'gt') return '>'; if (l === 'quot') return '"';
    if (l === 'apos') return "'"; if (l === 'nbsp') return ' ';
    const n = l[1] === 'x' ? parseInt(l.slice(2), 16) : parseInt(l.slice(1), 10);
    return Number.isFinite(n) ? String.fromCodePoint(n) : m;
  });
}
function titleOf(html) { const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i); return m ? decodeEntities(m[1].replace(/<[^>]+>/g, '')).trim() : ''; }

function insertionIndex(html) {
  let m = html.match(/<meta\b[^>]*\bcharset\s*=[^>]*>/i);
  if (m && m.index < (html.search(/<\/head>/i) >>> 0 || Infinity)) return m.index + m[0].length;
  m = html.match(/<head\b[^>]*>/i); if (m) return m.index + m[0].length;
  m = html.match(/<html\b[^>]*>/i); if (m) return m.index + m[0].length;
  m = html.match(/<!doctype[^>]*>/i); if (m) return m.index + m[0].length;
  return 0;
}

/* ---- CSP: directive helpers ---- */
function cspParts(html) {
  const meta = cspMeta(html); if (!meta) return null;
  const cm = meta.tag.match(/content=("([^"]*)"|'([^']*)')/i);
  return {meta, cm, q: cm[1][0], content: cm[2] ?? cm[3]};
}
function cspDirectives(content) {
  const out = {};
  for (const part of content.split(';')) {
    const t = part.trim(); if (!t) continue;
    const [name, ...src] = t.split(/\s+/);
    out[name.toLowerCase()] = src;
  }
  return out;
}
function setCspContent(html, p, newContent) {
  const newTag = p.meta.tag.replace(p.cm[0], `content=${p.q}${newContent}${p.q}`);
  return html.replace(p.meta.tag, () => newTag);
}
function styleBody(html) { const m = html.match(/<style\b[^>]*\bid=["']fff-style["'][^>]*>([\s\S]*?)<\/style>/i); return m ? m[1] : null; }
const reEsc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Scoate din style-src hash-ul blocului <style id="fff-style"> curent (înainte de înlocuire/ștergere). */
function dropStyleHash(html) {
  const body = styleBody(html), p = cspParts(html);
  if (body == null || !p) return html;
  const h = `'sha256-${sha256b64(body)}'`;
  if (!p.content.includes(h)) return html;
  let nc = p.content.replace(new RegExp(`\\s*${reEsc(h)}`, 'g'), '');
  nc = nc.replace(/(^|;\s*)style-src\s*(?=;|$)/, '$1').replace(/;\s*;/g, ';').replace(/^\s*;\s*/, '').replace(/;\s*$/, '');
  return setCspContent(html, p, nc);
}
/** Adaugă hash-ul stilului kitului în style-src când CSP nu permite 'unsafe-inline' pentru stiluri. */
function addStyleHash(html) {
  const body = styleBody(html), p = cspParts(html);
  if (body == null || !p) return html;
  const dirs = cspDirectives(p.content);
  const eff = dirs['style-src'] || dirs['default-src'];
  if (!eff || eff.includes("'unsafe-inline'")) return html;
  const h = `'sha256-${sha256b64(body)}'`;
  let content = p.content;
  if (dirs['style-src']) {
    if (dirs['style-src'].includes(h)) return html;
    content = content.replace(/(^|;\s*)style-src([^;]*)/, (m0, pre, rest) => `${pre}style-src${rest.replace(/\s+$/, '')} ${h}`);
  } else content = `${content.replace(/;\s*$/, '')}; style-src ${h}`;
  return setCspContent(html, p, content);
}

/* ---------------- apply / remove ---------------- */
function buildBlock(slug, modules, opt) {
  const ver = kitVersion();
  for (const m of modules) if (!ORDER.includes(m)) throw new Error(`modul necunoscut: ${m} (valide: ${ORDER.join(', ')})`);
  if (!modules.includes('core')) throw new Error('modulul „core” este obligatoriu');
  const sorted = ORDER.filter((m) => modules.includes(m));
  const missing = sorted.filter((m) => !fs.existsSync(path.join(KIT, 'src', m + '.js')));
  if (missing.length) throw new Error(`module lipsă (src/<nume>.js nu există): ${missing.join(', ')}`);
  let js = '', css = rd('src/kit.css');
  const i18n = {};
  for (const m of sorted) {
    js += `/* ---- fff-kit/${m} ---- */\n` + rd(`src/${m}.js`).replace(/\s+$/, '') + '\n';
    const cp = path.join(KIT, 'src', m + '.css');
    if (fs.existsSync(cp)) css += fs.readFileSync(cp, 'utf8');
    const ip = path.join(KIT, 'i18n', m + '.json');
    if (fs.existsSync(ip)) i18n[m] = JSON.parse(fs.readFileSync(ip, 'utf8'));
    else if (m !== 'core') console.error(`avertisment: lipsește i18n/${m}.json`);
  }
  if (/<\/script|<!--/i.test(js)) throw new Error('sursa kitului conține „</script” sau „<!--” (interzis în script inline)');
  if (/<\/style/i.test(css)) throw new Error('CSS-ul kitului conține „</style”');
  const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const lines = [
    `<!--fff:kit:start v=${FORMAT_V} modules=${sorted.join(',')}-->`,
    `<meta name="fff-app" content="${attr(slug)}">`,
    `<meta name="fff-modules" content="${sorted.join(',')}">`,
  ];
  if (opt.disable) lines.push(`<meta name="fff-disable" content="${attr(opt.disable)}">`);
  lines.push(`<style id="fff-style">${css.replace(/\s+$/, '')}</style>`);
  lines.push(`<script id="fff-kit">/* fff-kit ${ver} */\n${js}</script>`);
  lines.push(`<script type="application/json" id="fff-i18n">${escJsonForHtml(JSON.stringify(i18n))}</script>`);
  lines.push('<!--fff:kit:end-->');
  return {text: '\n' + lines.join('\n'), modules: sorted};
}
function currentModules(html) {
  const m = html.match(/<!--fff:kit:start[^>]*\bmodules=([a-z0-9,]+)/);
  return m ? m[1].split(',') : [];
}
function readConfig(dir) {
  const p = path.join(dir, 'fff.config.json');
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { throw new Error(`fff.config.json invalid: ${e.message}`); }
}

function applyKit(dirArg, opt) {
  const {file, dir} = resolveTarget(dirArg);
  let html = readHtml(file);
  const cfg = readConfig(dir);
  const slug = (opt.slug || metaContent(html, 'fff-app') || cfg.slug || '').trim();
  if (!slug) throw new Error('lipsește --slug');
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(slug)) throw new Error(`slug invalid: ${slug}`);
  const modules = (opt.modules || currentModules(html).join(',') || 'core,label,bundle').split(',').map((s) => s.trim()).filter(Boolean);
  const disable = opt.disable || cfg.disable || cfg.kitDisabled || '';
  const {text, modules: sorted} = buildBlock(slug, modules, {disable: typeof disable === 'string' ? disable : ''});
  html = dropStyleHash(html);
  if (BLOCK_RE.test(html)) html = html.replace(BLOCK_RE, () => text);
  else { const i = insertionIndex(html); html = html.slice(0, i) + text + html.slice(i); }
  html = addStyleHash(html);
  html = recomputeCspHashes(html).html;
  if (/\r\n/.test(inlineScripts(html).map((s) => s.body).join(''))) console.error('avertisment: scripturi inline cu CRLF — hash-urile CSP pot să nu corespundă după normalizarea browserului');
  const hadInfo = INFO_RE.test(html) || fs.existsSync(path.join(dir, 'app.json'));
  writeIfChanged(file, html);
  if (hadInfo && INFO_RE.test(html)) runInfo(dirArg, {slug});
  return {file, slug, modules: sorted};
}

function removeKit(dirArg) {
  const {file} = resolveTarget(dirArg);
  let html = readHtml(file);
  const hadBlock = BLOCK_RE.test(html);
  html = dropStyleHash(html);
  html = html.replace(BLOCK_RE, '').replace(INFO_RE, '');
  html = html.replace(/(<html\b[^>]*?)\s+data-fff-hash="[0-9a-f]*"/i, '$1');
  html = recomputeCspHashes(html).html;
  writeIfChanged(file, html);
  return {file, removed: hadBlock};
}

/* ---------------- check ---------------- */
function canonicalize(s) {
  return s.replace(/data-fff-hash="[0-9a-f]*"/g, 'data-fff-hash=""').replace(/"sha256":"[0-9a-f]*"/g, '"sha256":""');
}
function checkKit(dirArg, opt = {}) {
  const {file} = resolveTarget(dirArg);
  const html = readHtml(file);
  const errors = [], warns = [];
  const add = (lax, msg) => (lax && opt.lax ? warns : errors).push(msg);
  const starts = (html.match(/<!--fff:kit:start/g) || []).length, ends = (html.match(/<!--fff:kit:end-->/g) || []).length;
  if (starts !== 1 || ends !== 1) errors.push(`marcaje kit: ${starts} start / ${ends} end (se așteaptă 1/1)`);
  else {
    if (!/<meta name="fff-app" content="[^"]+">/.test(html)) errors.push('lipsește <meta name="fff-app">');
    if (!/<script id="fff-kit">/.test(html)) errors.push('lipsește <script id="fff-kit">');
    if (!/<style id="fff-style">/.test(html)) errors.push('lipsește <style id="fff-style">');
    if (!/<script type="application\/json" id="fff-i18n">/.test(html)) errors.push('lipsește #fff-i18n');
    const mods = currentModules(html);
    if (!mods.includes('core')) errors.push('modulul core lipsește din marcaj');
    const kitScript = html.match(/<script id="fff-kit">([\s\S]*?)<\/script>/);
    if (kitScript) for (const m of mods) if (!kitScript[1].includes(`/* ---- fff-kit/${m} ---- */`)) errors.push(`modulul ${m} declarat dar absent din script`);
    const ver = (kitScript && kitScript[1].match(/\/\* fff-kit ([0-9.]+) \*\//)) || [];
    if (ver[1] && ver[1] !== kitVersion()) warns.push(`kit v${ver[1]} în fișier, v${kitVersion()} disponibilă (rulează apply)`);
  }
  const c = checkCspHashes(html);
  if (!c.ok) errors.push(`hash-uri CSP lipsă pentru ${c.missing.length} script(uri) inline`);
  const p = cspParts(html);
  if (p) {
    const dirs = cspDirectives(p.content);
    const sm = html.match(/<style\b[^>]*\bid=["']fff-style["'][^>]*>([\s\S]*?)<\/style>/i);
    const eff = dirs['style-src'] || dirs['default-src'];
    if (sm && eff && !eff.includes("'unsafe-inline'") && !eff.includes(`'sha256-${sha256b64(sm[1])}'`)) errors.push('stilul kitului nu este permis de CSP (style-src)');
  }
  if (!metaContent(html, 'application-version')) add(true, 'lipsește <meta name="application-version">');
  if (!metaContent(html, 'last-updated')) add(true, 'lipsește <meta name="last-updated">');
  if (!/\bid=["']?app-version\b/.test(html)) add(true, 'lipsește elementul #app-version');
  if (INFO_RE.test(html)) {
    const declared = (html.match(/<html\b[^>]*\bdata-fff-hash="([0-9a-f]*)"/i) || [])[1] || '';
    const calc = sha256hex(Buffer.from(canonicalize(html), 'utf8'));
    if (declared !== calc) errors.push(`SHA-256 din fff-info învechit (declarat ${declared.slice(0, 12) || '∅'}…, calculat ${calc.slice(0, 12)}…): rulează info`);
    const im = html.match(/<script type="application\/json" id="fff-info">([\s\S]*?)<\/script>/);
    try { JSON.parse(im[1]); } catch { errors.push('fff-info nu este JSON valid'); }
  }
  return {file, ok: errors.length === 0, errors, warns};
}

/* ---------------- info ---------------- */
const PERMS = [
  ['getUserMedia', /\bgetUserMedia\b/],
  ['geolocation', /navigator\.geolocation|\bgeolocation\s*\.\s*(?:getCurrentPosition|watchPosition)/],
  ['RTCPeerConnection', /\bRTCPeerConnection\b/],
  ['navigator.share', /navigator\.(?:share|canShare)\b/],
  ['Notification', /\bnew\s+Notification\s*\(|\bNotification\s*\.\s*requestPermission/],
  ['speechSynthesis', /\bspeechSynthesis\b|\bSpeechSynthesisUtterance\b/],
  ['SpeechRecognition', /\b(?:webkitS|s)peechRecognition\b|\bSpeechRecognition\b/],
  ['clipboard', /navigator\.clipboard|execCommand\(\s*['"](?:copy|cut|paste)['"]/],
  ['serviceWorker', /\bserviceWorker\b/],
  ['indexedDB', /\bindexedDB\b/],
  ['localStorage', /\blocalStorage\b/],
  ['Web Crypto', /\bcrypto\.subtle\b|\bcrypto\.getRandomValues\b/],
  ['WebGL', /getContext\(\s*['"](?:webgl2?|experimental-webgl)['"]|\bWebGLRenderingContext\b|\bWebGL2RenderingContext\b/],
  ['WebGPU', /navigator\.gpu\b/],
  ['Worker', /\bnew\s+(?:Shared)?Worker\s*\(/],
  ['BroadcastChannel', /\bnew\s+BroadcastChannel\s*\(/],
];
const NS_SKIP = /^\/(?:1999|2000|1998)\//;
const URLTAIL = '[^\\s\'"`)<>\\\\]*';

function hostOf(u) {
  try {
    const x = new URL(u);
    if (!/^(https?|wss?):$/.test(x.protocol)) return null;
    if (x.hostname === 'www.w3.org' && NS_SKIP.test(x.pathname)) return null;
    if (!x.hostname.includes('.') && x.hostname !== 'localhost') return null;
    return x.hostname;
  } catch { return null; }
}
function detectEgress(src, html) {
  const found = new Map(); // host -> Set(via)
  const add = (host, via) => { if (!host) return; if (!found.has(host)) found.set(host, new Set()); found.get(host).add(via); };
  const scan = (re, via, grp) => { let m; re.lastIndex = 0; while ((m = re.exec(src))) add(hostOf(m[grp]), typeof via === 'function' ? via(m) : via); };
  const U = `((?:https?|wss?):\\/\\/${URLTAIL})`;
  scan(new RegExp(`\\bfetch\\(\\s*['"\`]${U}`, 'g'), 'fetch', 1);
  scan(new RegExp(`\\.open\\(\\s*['"\`][A-Za-z]+['"\`]\\s*,\\s*['"\`]${U}`, 'g'), 'XMLHttpRequest', 1);
  scan(new RegExp(`new\\s+(WebSocket|EventSource)\\(\\s*['"\`]${U}`, 'g'), (m) => m[1], 2);
  scan(new RegExp(`\\bimportScripts\\([^)]*?['"\`]${U}`, 'g'), 'importScripts', 1);
  scan(new RegExp(`\\bimport\\(\\s*['"\`]${U}`, 'g'), 'import()', 1);
  scan(new RegExp(`\\bfrom\\s+['"]${U}`, 'g'), 'import', 1);
  scan(new RegExp(`sendBeacon\\(\\s*['"\`]${U}`, 'g'), 'sendBeacon', 1);
  scan(new RegExp(`\\.src\\s*=\\s*['"\`]${U}`, 'g'), 'src=', 1);
  scan(new RegExp(`url\\(\\s*['"]?${U}`, 'g'), 'css url()', 1);
  scan(new RegExp(`@import\\s+['"]${U}`, 'g'), '@import', 1);
  // atribute de resurse în marcaj (nu <a href>)
  const tagRe = /<(script|img|link|iframe|source|video|audio|embed|object|track|image|use|input|frame)\b([^>]*)>/gi;
  let m;
  while ((m = tagRe.exec(src))) {
    const tag = m[1].toLowerCase(), attrs = m[2];
    const rel = (attrs.match(/\brel\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '';
    if (tag === 'link' && !/^(stylesheet|preload|modulepreload|prefetch|preconnect|dns-prefetch|icon|shortcut|apple-touch-icon|manifest|import)/i.test(rel)) continue;
    for (const am of attrs.matchAll(/\b(?:src|href|data|poster|xlink:href)\s*=\s*["']?((?:https?|wss?):\/\/[^"'\s>]+)/gi)) add(hostOf(am[1]), tag + (tag === 'link' ? '[' + rel + ']' : ''));
  }
  // CSP
  const p = cspParts(html);
  if (p) {
    const dirs = cspDirectives(p.content);
    for (const d of ['default-src', 'connect-src', 'script-src', 'script-src-elem', 'img-src', 'media-src', 'font-src', 'style-src', 'frame-src', 'worker-src', 'child-src', 'form-action', 'manifest-src']) {
      for (const tok of dirs[d] || []) {
        if (tok.startsWith("'")) continue;
        if (/^(data|blob|mediastream|filesystem):$/i.test(tok)) continue;
        if (/^(https?|wss?):$/i.test(tok) || tok === '*') { add(`${tok === '*' ? '*' : tok}(orice gazdă)`, 'csp:' + d); continue; }
        const host = tok.replace(/^[a-z]+:\/\//i, '').replace(/[/:?#].*$/, '');
        if (host) add(host, 'csp:' + d);
      }
    }
  }
  return [...found.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([host, via]) => ({host, via: [...via].sort()}));
}
function detectStorageKeys(src) {
  const keys = new Set();
  const re = /(\b[\w$.]+)\s*\.\s*(?:getItem|setItem|removeItem)\(\s*(['"`])([^'"`$\\\n]{1,80})\2/g;
  let m;
  while ((m = re.exec(src))) { if (/sessionStorage$/i.test(m[1])) continue; if (!m[3].startsWith('fff.')) keys.add(m[3]); }
  const re2 = /localStorage\s*\[\s*(['"`])([^'"`$\\\n]{1,80})\1\s*\]/g;
  while ((m = re2.exec(src))) if (!m[2].startsWith('fff.')) keys.add(m[2]);
  // chei declarate ca constante (ex. var STORAGE_KEY = "app_state_v1"), dacă fișierul folosește localStorage
  if (/localStorage/.test(src)) {
    const re3 = /\b(?:var|let|const)\s+[A-Za-z_$]*KEY[A-Za-z_$]*\s*=\s*(['"])([A-Za-z][\w.:-]{3,60})\1/g;
    while ((m = re3.exec(src))) if (!m[2].startsWith('fff.')) keys.add(m[2]);
  }
  return [...keys].sort();
}
function detectLangs(src) {
  const SUP = ['ro', 'en', 'fr', 'it', 'es', 'pt', 'hu', 'de'];
  const got = SUP.filter((c) => new RegExp(`<option[^>]*value=["']${c}["']|data-lang=["']${c}["']|(?:^|[{,\\s])["']?${c}["']?\\s*:\\s*\\{`, 'm').test(src));
  return got.length >= 2 ? got : [];
}
function cspSummary(html) {
  const p = cspParts(html);
  if (!p) return {present: false};
  const dirs = cspDirectives(p.content), out = {};
  for (const [k, v] of Object.entries(dirs)) {
    const hashes = v.filter((t) => /^'sha(256|384|512)-/.test(t)).length;
    const rest = v.filter((t) => !/^'sha(256|384|512)-/.test(t));
    out[k] = [...rest, ...(hashes ? [`sha256×${hashes}`] : [])].join(' ') || "''";
  }
  const ss = dirs['script-src'] || dirs['default-src'] || [];
  return {present: true, directives: out, scriptInline: ss.includes("'unsafe-inline'") ? 'unsafe-inline' : ss.includes("'none'") ? 'none' : ss.some((t) => t.startsWith("'sha")) ? 'hash' : 'nerestricționat', connect: (dirs['connect-src'] || dirs['default-src'] || ['(nerestricționat)']).join(' ')};
}

async function probe(file) {
  const require = createRequire('/opt/node-tools/package.json');
  const {chromium} = require('playwright');
  const b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox']});
  const ctx = await b.newContext();
  const hosts = new Set();
  await ctx.route(/^https?:/, (r) => { try { hosts.add(new URL(r.request().url()).hostname); } catch { /* ignorat */ } r.abort(); });
  const pg = await ctx.newPage();
  await pg.goto('file://' + file);
  await pg.waitForTimeout(3500);
  const keys = await pg.evaluate(() => { try { return Object.keys(localStorage).filter((k) => !k.startsWith('fff.')); } catch { return []; } });
  await b.close();
  return {hosts: [...hosts], keys};
}

function computeInfo(html, dir, slug, extra) {
  const src = html.replace(BLOCK_RE, '').replace(INFO_RE, '');
  const cfg = readConfig(dir);
  const mods = currentModules(html);
  const eg = detectEgress(src, html);
  for (const h of extra.probeHosts || []) { const e = eg.find((x) => x.host === h); if (e) { if (!e.via.includes('runtime')) e.via.push('runtime'); } else eg.push({host: h, via: ['runtime']}); }
  const perms = PERMS.filter(([, re]) => re.test(src)).map(([n]) => n);
  const keys = [...new Set([...detectStorageKeys(src), ...(extra.probeKeys || [])])].sort();
  const hasBundle = mods.includes('bundle');
  const info = {
    schema: 1,
    slug,
    name: titleOf(html),
    version: metaContent(html, 'application-version'),
    updated: metaContent(html, 'last-updated'),
    description: metaContent(html, 'description'),
    egress: eg,
    permissions: perms,
    storageKeys: keys,
    sizeBytes: 0,
    sha256: '',
    csp: cspSummary(html),
    features: {
      export: hasBundle || /\.download\s*=|\bdownload=["']|createObjectURL/.test(src),
      import: hasBundle || /type=["']file["']|\bFileReader\b|showOpenFilePicker/.test(src),
      i18n: detectLangs(src),
      pwa: {manifest: /<link[^>]+rel=["']manifest["']/i.test(src), serviceWorker: /\bserviceWorker\b/.test(src)},
      modules: mods,
    },
    kit: mods.length ? {version: kitVersion(), modules: mods} : null,
    selfSerializing: /documentElement\.outerHTML/.test(src),
  };
  const reserved = new Set(['sizeBytes', 'sha256', 'schema']);
  for (const [k, v] of Object.entries(cfg)) if (!reserved.has(k) && k !== 'disable' && k !== 'kitDisabled') info[k] = v;
  return info;
}

function runInfo(dirArg, opt = {}, extra = {}) {
  const {file, dir} = resolveTarget(dirArg);
  let html = readHtml(file).replace(INFO_RE, '');
  const slug = (opt.slug || metaContent(html, 'fff-app') || readConfig(dir).slug || path.basename(dir).toLowerCase()).trim();
  const info = computeInfo(html, dir, slug, extra);
  // atributul data-fff-hash pe <html>
  const hm = html.match(/<html\b([^>]*)>/i);
  if (!hm) throw new Error('lipsește <html>');
  const setHash = (h, v) => h.replace(/<html\b([^>]*)>/i, (m0, a) => /\bdata-fff-hash=/.test(a)
    ? m0.replace(/data-fff-hash="[0-9a-f]*"/, `data-fff-hash="${v}"`)
    : `<html${a.replace(/\s*\/$/, '')} data-fff-hash="${v}">`);
  html = setHash(html, '');
  const place = (h, infoObj) => {
    const block = `\n<!--fff:info:start-->\n<script type="application/json" id="fff-info">${escJsonForHtml(JSON.stringify(infoObj))}</script>\n<!--fff:info:end-->`;
    const m = h.match(/<!--fff:kit:end-->/);
    const i = m ? m.index + m[0].length : insertionIndex(h);
    return h.slice(0, i) + block + h.slice(i);
  };
  // sizeBytes apare în fișier (cifrele lui) -> punct fix; hash-ul se calculează pe forma canonică (câmpurile de hash goale)
  let size = 0, canon = '', hash = '';
  for (let it = 0; it < 10; it++) {
    info.sizeBytes = size; info.sha256 = '';
    canon = place(html, info);
    const calc = Buffer.byteLength(canon, 'utf8') + 128; // două câmpuri de 64 hex (atribut + JSON)
    if (calc === size) break;
    size = calc;
    canon = '';
  }
  if (!canon) throw new Error('sizeBytes nu converge');
  hash = sha256hex(Buffer.from(canonicalize(canon), 'utf8'));
  info.sha256 = hash;
  const final = place(setHash(html, hash), info);
  if (Buffer.byteLength(final, 'utf8') !== info.sizeBytes) throw new Error('inconsecvență sizeBytes');
  if (sha256hex(Buffer.from(canonicalize(final), 'utf8')) !== hash) throw new Error('inconsecvență hash (canonicalizare)');
  writeIfChanged(file, final);
  writeIfChanged(path.join(dir, 'app.json'), JSON.stringify(info, null, 2) + '\n');
  return {file, info};
}

/* ---------------- CLI ---------------- */
function usage() {
  console.log(`fff-kit build
  node build.mjs apply <dir> --slug S --modules core,label,bundle[,qr,p2p,srs,tts,pii,search,ephem] [--disable "motiv"]
  node build.mjs remove <dir>
  node build.mjs check <dir> [--lax] [--json]
  node build.mjs info <dir> [--slug S] [--probe]
Module: ${ORDER.join(', ')}`);
}
export {applyKit, removeKit, checkKit, runInfo, canonicalize, sha256hex, ORDER, kitVersion};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const {pos, opt} = parseArgs(process.argv.slice(2));
  const [cmd, dir] = pos;
  (async () => {
    try {
      if (!cmd || !dir) { usage(); process.exit(cmd ? 2 : 0); }
      if (cmd === 'apply') { const r = applyKit(dir, opt); console.log(`apply ok: ${r.file} · slug=${r.slug} · module=${r.modules.join(',')}`); }
      else if (cmd === 'remove') { const r = removeKit(dir); console.log(r.removed ? `remove ok: ${r.file}` : `nimic de scos în ${r.file}`); }
      else if (cmd === 'check') {
        const r = checkKit(dir, opt);
        if (opt.json) console.log(JSON.stringify(r, null, 1));
        else { r.errors.forEach((e) => console.log('EROARE  ' + e)); r.warns.forEach((e) => console.log('avert.  ' + e)); console.log(r.ok ? `check ok: ${r.file}` : `check EȘUAT: ${r.file}`); }
        process.exit(r.ok ? 0 : 1);
      } else if (cmd === 'info') {
        const extra = {};
        if (opt.probe) { const {file} = resolveTarget(dir); const pr = await probe(file); extra.probeHosts = pr.hosts; extra.probeKeys = pr.keys; }
        const r = runInfo(dir, opt, extra);
        console.log(`info ok: ${r.file} · sha256=${r.info.sha256.slice(0, 16)}… · ${r.info.sizeBytes} B · egress=${r.info.egress.length} · permisiuni=${r.info.permissions.length}`);
      } else { usage(); process.exit(2); }
    } catch (e) { console.error('EROARE: ' + e.message); process.exit(1); }
  })();
}
