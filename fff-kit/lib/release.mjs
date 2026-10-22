// fff-kit · release — comanda unică de livrare pentru o aplicație (sau pentru toate depozitele):
//   apply kit (păstrând modulele/slug/disable) → bump versiune în toate locurile standard → fixcsp → info → check.
// Folosită de `node build.mjs release <dir>` și `node build.mjs release-all <rootdir>`. Nu rulează git.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {applyKit, checkKit, runInfo, kitVersion, ORDER} from '../build.mjs';
import {recomputeCspHashes} from './csp.mjs';

const BLOCK_RE = /\n<!--fff:kit:start[^>]*-->[\s\S]*?<!--fff:kit:end-->/;
const INFO_RE = /\n<!--fff:info:start-->[\s\S]*?<!--fff:info:end-->/;
const VER_RE = /^\d+(?:\.\d+){0,2}$/;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sha = (s) => createHash('sha256').update(s).digest('hex');

export function today() {
  if (process.env.FFF_TODAY) return process.env.FFF_TODAY;
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** patch|minor|none → noua versiune (X.Y.Z). Versiunile cu 1–2 componente sunt completate cu 0. Sufixe (-beta) nu sunt acceptate: folosește --to. */
export function bumpVersion(v, level) {
  if (level === 'none') return v;
  if (!VER_RE.test(v || '')) throw new Error(`versiune neacceptată pentru bump automat: „${v}” (folosește --to X.Y.Z)`);
  const p = v.split('.').map(Number); while (p.length < 3) p.push(0);
  if (level === 'minor') { p[1]++; p[2] = 0; } else if (level === 'patch') p[2]++;
  else if (level === 'major') { p[0]++; p[1] = 0; p[2] = 0; }
  else throw new Error(`--bump necunoscut: ${level} (patch|minor|none)`);
  return p.join('.');
}
/** Aceeași versiune scrisă în regex: 2.3.9 → 2\.3\.9. */
const reEscaped = (v) => v.replace(/\./g, '\\.');
/** Înlocuiește versiunea veche (delimitată: nu face parte dintr-un număr mai lung) — text simplu și forma de regex cu puncte escapate. Întoarce [text, nr]. */
export function replaceVersion(text, oldV, newV) {
  let n = 0;
  const plain = new RegExp(`(?<![\\d.A-UW-Za-uw-z_])${esc(oldV)}(?![\\w]|\\.\\d)`, 'g');
  const escd = new RegExp(`(?<![\\d.A-UW-Za-uw-z_])${esc(reEscaped(oldV))}(?![\\w]|\\\\\\.\\d|\\.\\d)`, 'g');
  text = text.replace(escd, () => { n++; return reEscaped(newV); });
  text = text.replace(plain, () => { n++; return newV; });
  return [text, n];
}

const KIT_LINE = /fff-kit|kit\.version|KIT_VERSION|kitVersion|FFF\.version|core\.version|\.kit\b|kitversion/i;
const DATE_LINE = /updated|last-updated|Ultima|Last updated|Zuletzt|Dernière|Ultimo|Última|Utolsó|date|data\b/i;

/** Versiuni (și date) hard-codate în teste: înlocuire pe linii; liniile despre versiunea KITULUI rămân neatinse. */
export function bumpTestText(text, oldV, newV, oldDate, newDate) {
  let changed = 0;
  const out = text.split('\n').map((line) => {
    if (KIT_LINE.test(line)) return line;
    let l = line, hit = false;
    const [t, n] = replaceVersion(l, oldV, newV);
    if (n) { l = t; hit = true; }
    if (oldDate && newDate && oldDate !== newDate && (hit || DATE_LINE.test(line)) && l.includes(oldDate)) { l = l.split(oldDate).join(newDate); hit = true; }
    if (hit) changed++;
    return l;
  });
  return {text: out.join('\n'), lines: changed};
}

const rdIf = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
function meta(html, name) {
  const m = html.match(new RegExp(`<meta\\b[^>]*\\bname=["']${name}["'][^>]*>`, 'i'));
  const c = m && m[0].match(/\bcontent=("([^"]*)"|'([^']*)')/i);
  return c ? (c[2] ?? c[3]) : '';
}
function setMeta(html, name, value) {
  const tag = html.match(new RegExp(`<meta\\b[^>]*\\bname=["']${name}["'][^>]*>`, 'i'));
  if (!tag) return {html, done: false};
  const nt = tag[0].replace(/\bcontent=("[^"]*"|'[^']*')/i, (m0, q) => `content=${q[0]}${value}${q[0]}`);
  if (nt === tag[0] && !/\bcontent=/i.test(tag[0])) return {html, done: false};
  return {html: html.replace(tag[0], () => nt), done: true};
}

/** Textul din #app-version: înlocuiește versiunea și data veche (doar în interiorul elementului). */
function bumpAppVersionEl(html, oldV, newV, oldDate, newDate) {
  const re = /(<(\w+)\b[^>]*\bid=["']app-version["'][^>]*>)([\s\S]*?)(<\/\2>)/i;
  const m = html.match(re);
  if (!m) return {html, changed: false, found: false};
  let inner = m[3];
  const [t, n] = replaceVersion(inner, oldV, newV);
  inner = t;
  let dn = 0;
  if (oldDate && newDate && oldDate !== newDate && inner.includes(oldDate)) { inner = inner.split(oldDate).join(newDate); dn = 1; }
  if (!n && !dn) return {html, changed: false, found: true};
  return {html: html.replace(re, (all, a, tag, b, c) => a + inner + c), changed: true, found: true};
}

function bumpSw(text, oldV, newV) {
  let n = 0;
  let out = text.replace(/(\bVERSION\s*=\s*)(["'`])([^"'`]*)\2/g, (m0, a, q, v) => { if (v === oldV) { n++; return `${a}${q}${newV}${q}`; } return m0; });
  const [t, k] = replaceVersion(out, oldV, newV); out = t; n += k;
  return {text: out, n};
}

const LABELS = ['Version', 'Versiune', 'Versione', 'Versión', 'Versão', 'Verzió'];
function bumpReadme(text, oldV, newV, oldDate, newDate) {
  // „**Version:** 2.3.9 · **Last updated:** 2026-10-22” (+ variante cu „ :” franceză). Se aliniază la versiunea nouă oricare ar fi cea scrisă (repară și README-uri rămase în urmă).
  const re = new RegExp(`^(\\*\\*(?:${LABELS.join('|')})\\s?:\\*\\*\\s*)\\d+(?:\\.\\d+){0,2}[^\\s·]*(\\s*·\\s*\\*\\*[^*\\n]+\\*\\*\\s*)(\\d{4}-\\d{2}-\\d{2})`, 'gm');
  let n = 0;
  const out = text.replace(re, (m0, a, b, d) => { n++; return `${a}${newV}${b}${newDate || d}`; });
  return {text: out, n};
}

function walkTests(dir) {
  const out = [];
  for (const sub of ['tests', 'test']) {
    const d = path.join(dir, sub);
    if (!fs.existsSync(d)) continue;
    const rec = (p, depth) => {
      for (const e of fs.readdirSync(p, {withFileTypes: true})) {
        if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
        const f = path.join(p, e.name);
        if (e.isDirectory()) { if (depth < 3) rec(f, depth + 1); } else if (/\.(?:mjs|cjs|js|ts)$/.test(e.name)) out.push(f);
      }
    };
    rec(d, 0);
  }
  return out;
}
/** Instantaneu: {cale relativă: sha} al fișierelor pe care le poate atinge release. */
function snapshot(dir) {
  const files = ['index.html', 'sw.js', 'app.json', 'fff.config.json', ...fs.readdirSync(dir).filter((f) => /^README(?:\.[a-z]{2})?\.md$/.test(f)), ...walkTests(dir).map((f) => path.relative(dir, f))];
  const o = {};
  for (const f of files) { const t = rdIf(path.join(dir, f)); if (t != null) o[f] = sha(t); }
  return o;
}
function copyApp(src) {
  const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'fff-release-'));
  const rec = (a, b, depth) => {
    for (const e of fs.readdirSync(a, {withFileTypes: true})) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const s = path.join(a, e.name), d = path.join(b, e.name);
      if (e.isDirectory()) { if (depth < 4) { fs.mkdirSync(d); rec(s, d, depth + 1); } }
      else if (e.isFile() && !/\.(?:png|jpe?g|gif|webp|mp4|webm|woff2?|zip)$/i.test(e.name)) fs.copyFileSync(s, d);
    }
  };
  rec(src, dst, 0);
  return dst;
}

/**
 * releaseApp(dir, {bump:'patch'|'minor'|'none'|'major', to, slug, modules, addModules, date, dryRun, lax, tests:true, readme:true})
 * Pașii: [bump] → apply → fixcsp → info → check. Întoarce un raport serializabil JSON.
 */
export function releaseApp(dirArg, opt = {}) {
  const rep = {dir: path.resolve(dirArg), slug: '', ok: false, dryRun: !!opt.dryRun, from: '', to: '', date: '', bump: opt.to ? 'to' : (opt.bump || 'patch'), kit: kitVersion(), modules: [], changed: [], steps: {}, warnings: [], errors: []};
  let work = rep.dir;
  try {
    const p = path.resolve(dirArg);
    if (!fs.existsSync(p)) throw new Error(`nu există: ${dirArg}`);
    const isFile = fs.statSync(p).isFile();
    const appDir = isFile ? path.dirname(p) : p;
    rep.dir = appDir;
    if (!fs.existsSync(path.join(appDir, 'index.html'))) throw new Error('lipsește index.html');
    const before = snapshot(appDir);
    work = opt.dryRun ? copyApp(appDir) : appDir;
    const file = path.join(work, 'index.html');
    let html = fs.readFileSync(file, 'utf8');

    /* --- identitate: slug, module, disable (se păstrează) --- */
    const hadKit = BLOCK_RE.test(html);
    const slug = (opt.slug || meta(html, 'fff-app') || '').trim();
    const curMods = ((html.match(/<!--fff:kit:start[^>]*\bmodules=([a-z0-9,]+(?:-[a-z0-9,]+)*)/) || [])[1] || '').split(',').filter(Boolean);
    if (!hadKit && !slug) throw new Error('aplicația nu are kit și lipsește --slug');
    let mods = opt.modules ? String(opt.modules).split(',').map((s) => s.trim()).filter(Boolean) : (curMods.length ? curMods : ['core', 'label', 'bundle']);
    if (opt.addModules) for (const m of String(opt.addModules).split(',').map((s) => s.trim()).filter(Boolean)) if (!mods.includes(m)) mods.push(m);
    for (const m of mods) if (!ORDER.includes(m)) throw new Error(`modul necunoscut: ${m}`);
    const disable = meta(html, 'fff-disable') || undefined;
    rep.slug = slug; rep.modules = ORDER.filter((m) => mods.includes(m));

    /* --- bump --- */
    const oldV = meta(html, 'application-version'), oldDate = meta(html, 'last-updated');
    rep.from = oldV; rep.date = opt.date || today();
    const level = opt.to ? 'to' : (opt.bump || 'patch');
    if (!['patch', 'minor', 'major', 'none', 'to'].includes(level)) throw new Error(`--bump necunoscut: ${level} (patch|minor|none)`);
    let newV = oldV, newDate = oldDate;
    if (level !== 'none') {
      if (!oldV) throw new Error('lipsește <meta name="application-version"> (nu pot ridica versiunea; folosește --bump none sau adaugă meta)');
      if (opt.to && !VER_RE.test(opt.to)) throw new Error(`--to invalid: ${opt.to}`);
      newV = opt.to || bumpVersion(oldV, level);
      newDate = rep.date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) throw new Error(`--date invalid: ${newDate}`);
    }
    rep.to = newV;
    if (level !== 'none' && (newV !== oldV || newDate !== oldDate)) {
      html = setMeta(html, 'application-version', newV).html;
      const lu = setMeta(html, 'last-updated', newDate); html = lu.html;
      if (!lu.done) rep.warnings.push('lipsește <meta name="last-updated"> (nu l-am creat)');
      const av = bumpAppVersionEl(html, oldV, newV, oldDate, newDate); html = av.html;
      if (!av.found) rep.warnings.push('lipsește elementul #app-version');
      fs.writeFileSync(file, html);
      rep.steps.bump = {from: oldV, to: newV, date: newDate, appVersionEl: av.found ? (av.changed ? 'actualizat' : 'neschimbat (fără versiune/dată în text)') : 'lipsă'};

      /* sw.js */
      const swp = path.join(work, 'sw.js'), sw = rdIf(swp);
      if (sw != null) { const r = bumpSw(sw, oldV, newV); if (r.n) fs.writeFileSync(swp, r.text); rep.steps.sw = r.n ? `${r.n} înlocuiri` : 'nicio apariție a versiunii vechi'; if (!r.n) rep.warnings.push('sw.js: versiunea veche nu a fost găsită (VERSION = "…")'); }
      /* README-uri */
      if (opt.readme !== false) {
        let rn = 0;
        for (const f of fs.readdirSync(work).filter((x) => /^README(?:\.[a-z]{2})?\.md$/.test(x))) {
          const t = fs.readFileSync(path.join(work, f), 'utf8'), r = bumpReadme(t, oldV, newV, oldDate, newDate);
          if (r.n) { fs.writeFileSync(path.join(work, f), r.text); rn++; }
        }
        rep.steps.readme = `${rn} fișiere`;
      }
      /* teste */
      if (opt.tests !== false && newV !== oldV) {
        let tl = 0, tf = 0;
        for (const f of walkTests(work)) {
          const t = fs.readFileSync(f, 'utf8'), r = bumpTestText(t, oldV, newV, oldDate, newDate);
          if (r.lines) { fs.writeFileSync(f, r.text); tf++; tl += r.lines; }
        }
        rep.steps.tests = `${tl} linii în ${tf} fișiere`;
      }
    } else rep.steps.bump = 'omis (--bump none sau versiune neschimbată)';

    /* --- apply kit (păstrează slug/module/disable) --- */
    const ap = applyKit(work, {slug: slug || undefined, modules: rep.modules.join(','), disable});
    rep.slug = ap.slug; rep.modules = ap.modules;
    rep.steps.apply = `kit ${kitVersion()} · module ${ap.modules.join(',')}`;

    /* --- fixcsp --- */
    const fx = recomputeCspHashes(fs.readFileSync(file, 'utf8'));
    if (fx.changed) fs.writeFileSync(file, fx.html);
    rep.steps.fixcsp = fx.changed ? 'rescris' : 'neschimbat';

    /* --- info (app.json + fff-info) --- */
    const inf = runInfo(work, {slug: ap.slug});
    rep.steps.info = {sha256: inf.info.sha256.slice(0, 16), sizeBytes: inf.info.sizeBytes, validation: inf.validation};
    if (inf.validation.length) rep.errors.push(...inf.validation.map((e) => 'fff-info: ' + e));

    /* --- versiuni rămase neactualizate în index.html (în afara locurilor standard) --- */
    if (level !== 'none' && newV !== oldV && oldV) {
      const app = fs.readFileSync(file, 'utf8').replace(BLOCK_RE, (m) => '\n'.repeat(m.split('\n').length - 1)).replace(INFO_RE, (m) => '\n'.repeat(m.split('\n').length - 1));
      const re = new RegExp(`(?<![\\d.A-UW-Za-uw-z_])${esc(oldV)}(?![\\w]|\\.\\d)`);
      const lines = app.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => re.test(l));
      if (lines.length) rep.warnings.push(`versiunea veche ${oldV} mai apare în index.html la liniile ${lines.slice(0, 6).map(([i]) => i).join(', ')}${lines.length > 6 ? '…' : ''} (în afara locurilor standard: verifică manual)`);
    }

    /* --- check --- */
    const ck = checkKit(work, {lax: !!opt.lax});
    rep.steps.check = {ok: ck.ok, errors: ck.errors, warns: ck.warns};
    if (!ck.ok) rep.errors.push(...ck.errors.map((e) => 'check: ' + e));
    rep.warnings.push(...ck.warns.map((w) => 'check: ' + w));

    /* --- fișiere modificate --- */
    const after = snapshot(work);
    rep.changed = Object.keys({...before, ...after}).filter((f) => before[f] !== after[f]).sort();
    rep.ok = rep.errors.length === 0;
  } catch (e) {
    rep.errors.push(e.message); rep.ok = false;
  } finally {
    if (opt.dryRun && work !== rep.dir) { try { fs.rmSync(work, {recursive: true, force: true}); } catch { /* ignorat */ } }
  }
  return rep;
}

/** Aplicațiile dintr-o rădăcină: <root>/<depozit>/index.html și <root>/<depozit>/apps/<app>/index.html (hubul). */
export function discoverApps(root) {
  const out = [];
  const r = path.resolve(root);
  for (const e of fs.readdirSync(r, {withFileTypes: true})) {
    if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'node_modules') continue;
    const d = path.join(r, e.name);
    const apps = path.join(d, 'apps');
    if (fs.existsSync(apps) && fs.statSync(apps).isDirectory()) {
      for (const a of fs.readdirSync(apps, {withFileTypes: true})) if (a.isDirectory() && fs.existsSync(path.join(apps, a.name, 'index.html'))) out.push(path.join(apps, a.name));
    }
    if (e.name !== 'chiuta.github.io' && fs.existsSync(path.join(d, 'index.html'))) out.push(d);   // rădăcina hubului nu e o aplicație
  }
  return out.sort();
}

/** release-all: raport JSON cu o intrare per aplicație. Aplicațiile fără kit sunt omise (status „no-kit”) dacă nu e dat --init. */
export function releaseAll(root, opt = {}) {
  const only = opt.only ? String(opt.only).split(',') : null, skip = new Set(opt.skip ? String(opt.skip).split(',') : []);
  const rows = [];
  for (const d of discoverApps(root)) {
    const name = path.basename(d);
    if ((only && !only.includes(name)) || skip.has(name)) continue;
    const html = fs.readFileSync(path.join(d, 'index.html'), 'utf8');
    if (!BLOCK_RE.test(html) && !opt.init) { rows.push({dir: d, slug: '', ok: true, status: 'no-kit', changed: [], warnings: ['fără kit — omis (o aplicație nouă: node build.mjs release <dir> --slug S, sau --init aici)'], errors: []}); continue; }
    const r = releaseApp(d, {...opt, slug: opt.init ? (opt.slug || name.toLowerCase()) : undefined});
    r.status = r.ok ? (r.changed.length ? 'changed' : 'unchanged') : 'error';
    rows.push(r);
  }
  const summary = {root: path.resolve(root), dryRun: !!opt.dryRun, kit: kitVersion(), total: rows.length, ok: rows.filter((r) => r.ok && r.status !== 'no-kit').length, errors: rows.filter((r) => !r.ok).length, noKit: rows.filter((r) => r.status === 'no-kit').length, bump: opt.to ? opt.to : (opt.bump || 'patch')};
  return {summary, apps: rows};
}
