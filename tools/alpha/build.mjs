#!/usr/bin/env node
// scripts/build.mjs — asamblează aplicația din src/ în index.html (pagina-vitrină a depozitului).
//
//   node scripts/build.mjs            compune și scrie index.html (apoi hash-uri CSP + eticheta kitului, dacă kitul e găsit)
//   node scripts/build.mjs --check    nu scrie nimic: iese cu cod 1 dacă index.html nu corespunde cu src/
//   node scripts/build.mjs --no-kit   sare peste pasul kitului (hash-urile CSP de script/stil se recalculează oricum)
//   node scripts/build.mjs --kit DIR  folosește fff-kit din DIR (implicit: $FFF_KIT sau ../chiuta.github.io/fff-kit)
//
// Surse (în rădăcina depozitului):
//   src/app.json     {"slug","version","updated","plugins":"plugins"|null,"data":"data/<dir>"|null,"audio":"audio"?,"files":{"NUME":"cale.json"}?}
//                    + "pwa":{"categories":["education"],"theme"?,"bg"?,"mono"?,"name"?,"short"?} (opțional): după kit se aplică fff-kit/pwa (manifest, sw.js, pictograme); --check îl verifică
//                    + "connect":["https://gazda.tld"] (opțional): singurele gazde din connect-src (https, fără căi); fără ea pagina rămâne fără rețea (default-src 'none')
//                    + "csp":{"img-src":["blob:"],"media-src":["blob:"]} (opțional): jetoane suplimentare pe directive; valorile permise: 'self', scheme: (blob:, data:) și origini https
//                    + "sandbox":{"widgets":"widgets","boot":"src/sandbox.js","css":"src/sandbox.css"} (opțional): widgeturile din widgets/<id>/index.js NU rulează în pagină; fiecare devine un bloc
//                      inert <script type="text/x-fff-sandbox" id="w-<id>" data-sha256="…"> (boot + widget; kitul îi pune hash-ul în script-src) și un singur <style id="w-css" media="not all"> (css de bază +
//                      widgets/<id>/style.css). Aplicația le pune la rulare în <iframe sandbox="allow-scripts" srcdoc>, care moștenește CSP-ul paginii. Fiecare widget are un descriptor în «data».
//   src/engine.mjs   logică pură (module ES; «export» se elimină la asamblare) — testată cu node --test
//   src/ui.js        interfața (cod clasic; trebuie să definească function mount(el, lang))
//   src/i18n.mjs     export default {ro:{...}, en:{...}, fr:..., de:..., es:..., it:..., hu:..., pt:...}
//   src/app.css      stiluri (doar clase, fără atribute style="" — CSP strict)
//   plugins/*.js     (opțional) module ES cu «export function/const»; fiecare devine PLUGINS[<nume>] în pagină
//
// Rezultatul din pagină: <style id="app-style">, <script id="app-js"> (înaintea scriptului paginii) și 4 mici
// ancore în scriptul paginii (nav, card, montare, buton). Scripturile noi rămân ES2017 (vezi docs/COMPATIBILITATE.md din hub).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL, fileURLToPath} from 'node:url';

const LANGS = ['ro', 'en', 'fr', 'de', 'es', 'it', 'hu', 'pt'];
const rd = (root, p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (root, p) => fs.existsSync(path.join(root, p));
const sha64 = (s) => createHash('sha256').update(s, 'utf8').digest('base64');
const J = (v) => JSON.stringify(v).replace(/<\//g, '<\\/').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/* ---------------- shell: parsare / serializare ---------------- */
export function parseShell(html) {
  const lines = html.split('\n');
  const i = lines.findIndex((l) => l.startsWith('var D={'));
  if (i < 0) throw new Error("index.html: nu găsesc linia «var D={» a paginii-vitrină");
  let j = i;
  while (j < lines.length && !/KEY\s*=\s*D\.slug\s*\+\s*"\.lang"/.test(lines[j])) j++;
  if (j >= lines.length) throw new Error('index.html: nu găsesc sfârșitul declarației «KEY=D.slug+".lang"»');
  const stmt = lines.slice(i, j + 1).join('\n');
  const m = stmt.match(/^([\s\S]*?KEY\s*=\s*D\.slug\s*\+\s*"\.lang")(;?)([\s\S]*)$/);
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(m[1] + ';this.D=D;this.U=U;this.NM=NM;this.LG=LG;', ctx);
  return {lines, start: i, end: j, D: ctx.D, U: ctx.U, NM: ctx.NM, LG: ctx.LG, rest: m[3]};
}
export function serializeShell(sh) {
  const stmt = `var D=${J(sh.D)},U=${J(sh.U)},NM=${J(sh.NM)},LG=${J(sh.LG)},KEY=D.slug+".lang";${sh.rest}`;
  return [...sh.lines.slice(0, sh.start), stmt, ...sh.lines.slice(sh.end + 1)].join('\n');
}

/* ---------------- ancorele din scriptul paginii ---------------- */
const PATCHES = [
  {
    name: 'nav',
    from: 'nav.push(["#join",T("nav_join")]);',
    to: 'nav.push(["#join",T("nav_join")]);if(window.APP)nav.splice(1,0,["#app",window.APP.t(lang,"nav")]);'
  },
  {
    name: 'card',
    from: 'var secs=D.secs[lang],h="";',
    to: 'var secs=D.secs[lang],h=window.APP?card("app","appcard",esc(window.APP.t(lang,"title")),\'<div id="appmount"></div>\'):"";'
  },
  {
    name: 'mount',
    from: '$("#content").innerHTML=h;',
    to: '$("#content").innerHTML=h;if(window.APP)window.APP.mount($("#appmount"),lang);'
  },
  {
    name: 'cta',
    from: '$("#cta").innerHTML=\'<a class="btn pri" href="https://github.com/chiuta/\'',
    to: '$("#cta").innerHTML=(window.APP?\'<a class="btn pri" href="#app">\'+esc(window.APP.t(lang,"open"))+"</a>":"")+\'<a class="btn\'+(window.APP?"":" pri")+\'" href="https://github.com/chiuta/\''
  }
];
export function patchShellScript(html) {
  let out = html;
  for (const p of PATCHES) {
    if (out.includes(p.to)) continue;
    if (!out.includes(p.from)) throw new Error(`ancora «${p.name}» nu se potrivește: pagina-vitrină a fost schimbată?`);
    out = out.replace(p.from, () => p.to);
  }
  return out;
}

/* ---------------- compunere ---------------- */
function stripExports(code, where) {
  const bad = code.match(/^\s*export\s+(default|\{|\*)/m);
  if (bad) throw new Error(`${where}: sunt permise doar «export function|const|let|var|class» (am găsit «${bad[0].trim()}»)`);
  if (/^\s*import\s/m.test(code)) throw new Error(`${where}: «import» nu e permis în fișierele asamblate (pagina e un singur fișier)`);
  return code.replace(/^(\s*)export\s+(?=(async\s+function|function|const|let|var|class)\b)/gm, '$1');
}
function exportedNames(code) {
  const names = [];
  const re = /^\s*export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(code))) names.push(m[1]);
  return names;
}

export async function compose(root) {
  const cfg = JSON.parse(rd(root, 'src/app.json'));
  const i18nMod = await import(pathToFileURL(path.join(root, 'src/i18n.mjs')).href + '?t=' + Date.now());
  const I18N = i18nMod.default;
  const problems = [];
  const en = I18N.en || {};
  for (const l of LANGS) {
    if (!I18N[l]) { problems.push(`i18n: lipsește limba ${l}`); continue; }
    for (const k of Object.keys(en)) if (!(k in I18N[l])) problems.push(`i18n: ${l} nu are cheia «${k}»`);
    for (const k of Object.keys(I18N[l])) if (!(k in en)) problems.push(`i18n: ${l} are cheia în plus «${k}»`);
    for (const [k, v] of Object.entries(I18N[l])) {
      if (typeof v === 'string' && v.trim() === '') problems.push(`i18n: ${l}.${k} este gol`);
      if (typeof v === 'string' && en[k] && typeof en[k] === 'string') {
        const ph = (s) => (s.match(/\{\d\}/g) || []).sort().join('');
        if (ph(v) !== ph(en[k])) problems.push(`i18n: ${l}.${k} are alte substituenți {n} decât en`);
      }
    }
  }
  if (problems.length) throw new Error(problems.slice(0, 20).join('\n') + (problems.length > 20 ? `\n… +${problems.length - 20}` : ''));

  const parts = [];
  parts.push('(function(){\n"use strict";');
  parts.push('var I18N=' + J(I18N) + ';');
  if (cfg.data) {
    const dir = path.join(root, cfg.data);
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'example.json').sort() : [];
    const data = {};
    for (const f of files) {
      const o = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      // cfg.audio = "audio": câmpul «audio» al unei înregistrări (cale relativă) devine URI de date, ca pagina să rămână un singur fișier
      if (cfg.audio && typeof o.audio === 'string' && !o.audio.startsWith('data:')) {
        const ap = path.join(root, cfg.audio, path.basename(o.audio));
        if (!fs.existsSync(ap)) throw new Error(`${cfg.data}/${f}: fișierul audio «${o.audio}» nu există în ${cfg.audio}/`);
        const buf = fs.readFileSync(ap);
        const ext = path.extname(ap).slice(1).toLowerCase();
        const mime = ext === 'webm' ? 'audio/webm' : ext === 'ogg' || ext === 'opus' ? 'audio/ogg' : '';
        if (!mime) throw new Error(`${cfg.audio}/${path.basename(ap)}: sunt acceptate doar .opus, .ogg și .webm`);
        if (buf.length > 51200) throw new Error(`${cfg.audio}/${path.basename(ap)}: ${buf.length} de octeți (limita este 51200)`);
        o.audio = `data:${mime};base64,${buf.toString('base64')}`;
      }
      data[o.id || f.replace(/\.json$/, '')] = o;
    }
    parts.push('var DATA=' + J(data) + ';');
  }
  // cfg.files = {"NUME": "cale/fisier.json"}: fișiere JSON suplimentare, expuse ca variabile globale ale ambalajului (ex. LANGUAGES, CONCEPTS)
  if (cfg.files) {
    for (const [name, rel] of Object.entries(cfg.files)) {
      if (!/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error(`src/app.json: numele «${name}» din «files» trebuie să fie MAJUSCULE`);
      parts.push(`var ${name}=` + J(JSON.parse(rd(root, rel))) + ';');
    }
  }
  if (cfg.plugins && exists(root, cfg.plugins)) {
    const dir = path.join(root, cfg.plugins);
    parts.push('var PLUGINS={};');
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js')).sort()) {
      const code = rd(root, path.join(cfg.plugins, f));
      const names = exportedNames(code);
      if (!names.length) throw new Error(`${cfg.plugins}/${f}: nu exportă nimic`);
      const id = f.replace(/\.js$/, '');
      parts.push(`PLUGINS[${J(id)}]=(function(){\n${stripExports(code, f)}\nreturn {${names.map((n) => `${n}:${n}`).join(',')}};\n})();`);
    }
  }
  const sandbox = cfg.sandbox ? composeSandbox(root, cfg) : null;
  if (exists(root, 'src/engine.mjs')) parts.push(stripExports(rd(root, 'src/engine.mjs'), 'src/engine.mjs'));
  parts.push('function tr(lang,key){var s=I18N[lang]&&I18N[lang][key];if(s==null)s=I18N.en[key];if(s==null)s=key;return s}');
  parts.push('function fmt(s){var a=arguments;return String(s).replace(/\\{(\\d)\\}/g,function(_,i){return a[+i+1]})}');
  const ui = rd(root, 'src/ui.js');
  if (!/function\s+mount\s*\(/.test(ui)) throw new Error('src/ui.js trebuie să definească function mount(el, lang)');
  parts.push(ui);
  parts.push('window.APP={t:tr,mount:mount,version:' + J(cfg.version) + '};\n})();');
  const js = parts.join('\n');
  const css = exists(root, 'src/app.css') ? rd(root, 'src/app.css') : '';
  if (/\bstyle\s*=\s*["']/.test(ui)) problems.push('src/ui.js: atribute style="" interzise de CSP; folosește clase');
  if (problems.length) throw new Error(problems.join('\n'));
  return {cfg, js, css, sandbox};
}

/* ---------------- widgeturi în sandbox: blocuri inerte + un singur CSS ---------------- */
const INERT_BAD = /<!--|<\/?script/i;
const widgetIds = (root, cfg) => {
  const wdir = path.join(root, cfg.sandbox.widgets);
  return fs.existsSync(wdir) ? fs.readdirSync(wdir, {withFileTypes: true}).filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];
};
export function composeSandbox(root, cfg) {
  const sb = cfg.sandbox;
  if (!sb || typeof sb !== 'object' || Array.isArray(sb)) throw new Error('src/app.json: «sandbox» trebuie să fie un obiect');
  for (const k of ['widgets', 'boot']) if (typeof sb[k] !== 'string' || !sb[k]) throw new Error(`src/app.json: «sandbox.${k}» lipsește`);
  if (!exists(root, sb.boot)) throw new Error(`src/app.json: «sandbox.boot» (${sb.boot}) nu există`);
  const lf = (t) => t.replace(/\r\n/g, '\n');
  const boot = lf(rd(root, sb.boot));
  const css = [sb.css && exists(root, sb.css) ? lf(rd(root, sb.css)).trim() : ''];
  const scripts = {};
  const ids = widgetIds(root, cfg);
  if (!ids.length) throw new Error(`src/app.json: «sandbox.widgets» (${sb.widgets}/) nu conține niciun widget`);
  const known = cfg.data && exists(root, cfg.data) ? fs.readdirSync(path.join(root, cfg.data)).filter((f) => f.endsWith('.json') && f !== 'example.json').map((f) => f.replace(/\.json$/, '')) : [];
  for (const id of ids) {
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`${sb.widgets}/${id}: numele directorului trebuie să fie [a-z0-9-]+`);
    const rel = path.join(sb.widgets, id, 'index.js');
    if (!exists(root, rel)) throw new Error(`${rel}: lipsește`);
    if (!known.includes(id)) throw new Error(`${rel}: widgetul nu are descriptor în ${cfg.data || 'data'}/${id}.json`);
    const code = lf(rd(root, rel));
    if (!/^\s*export\s+function\s+mount\s*\(/m.test(code)) throw new Error(`${rel}: trebuie să exporte «export function mount(container, api)»`);
    if (INERT_BAD.test(code)) throw new Error(`${rel}: conține «<!--», «<script» sau «</script» — nepermis într-un bloc sandbox`);
    const text = '"use strict";\n' + boot + '\nPFS.start((function(){\n' + stripExports(code, rel) + '\nreturn {mount:mount,unmount:(typeof unmount==="function"?unmount:null),strings:(typeof strings==="undefined"?null:strings)};\n})());\n';
    if (INERT_BAD.test(text)) throw new Error(`${sb.boot}: conține «<!--», «<script» sau «</script» — nepermis într-un bloc sandbox`);
    scripts[id] = text;
    const cp = path.join(sb.widgets, id, 'style.css');
    if (exists(root, cp)) css.push('/* ' + id + ' */\n' + lf(rd(root, cp)).trim());
  }
  for (const id of known) if (!ids.includes(id)) throw new Error(`${cfg.data}/${id}.json: descriptor fără widget în ${sb.widgets}/${id}/`);
  const cssText = css.filter(Boolean).join('\n') + '\n';
  if (/<\/style/i.test(cssText)) throw new Error('CSS-ul widgeturilor conține «</style»');
  return {scripts, css: cssText};
}
const sandboxHtml = (sb) => Object.keys(sb.scripts).sort().map((id) => `<script type="text/x-fff-sandbox" id="w-${id}" data-sha256="${sha64(sb.scripts[id])}">${sb.scripts[id]}</script>\n`).join('');
const sandboxCssHtml = (sb) => `<style id="w-css" media="not all" data-sha256="${sha64(sb.css)}">${sb.css}</style>\n`;

/* ---------------- sincronizarea blocului D (sarcini, versiune, fișiere de date, schemă) ---------------- */
function listJson(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listJson(p));
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
}
/* secțiunile vitrinei (pașii de contribuție, sarcinile, licența, sprijinul) urmează README-ul fiecărei limbi, ca pagina să nu spună altceva decât depozitul */
const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
/** markdown în linie → HTML: `cod`, **aldin** și [text](https://…); restul este text, cu caracterele speciale înlocuite */
export function mdInline(s) {
  let out = '', i = 0;
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g;
  for (let m; (m = re.exec(s));) {
    out += escHtml(s.slice(i, m.index));
    if (m[1] !== undefined) out += '<code>' + escHtml(m[1]) + '</code>';
    else if (m[2] !== undefined) out += '<strong>' + escHtml(m[2]) + '</strong>';
    else out += '<a href="' + escHtml(m[4]) + '" target="_blank" rel="noopener noreferrer">' + escHtml(m[3]) + '</a>';
    i = m.index + m[0].length;
  }
  return out + escHtml(s.slice(i));
}
/** Cele patru secțiuni din vitrină (contrib5, issues, license, support) citite din README: o listă numerotată, apoi trei paragrafe. Întoarce null dacă forma e alta (atunci vitrina rămâne cum era). */
export function secsFromReadme(md) {
  const parts = md.replace(/\r\n/g, '\n').split(/^## /m).slice(1).map((s) => { const nl = s.indexOf('\n'); return {h: s.slice(0, nl).trim(), body: s.slice(nl + 1).trim()}; });
  const i = parts.findIndex((s) => /^1\. /.test(s.body));
  if (i < 0 || parts.length < i + 4) return null;
  const items = [];
  for (const line of parts[i].body.split('\n')) {
    if (!line.trim()) continue;
    const m = /^\d+\. (.+)$/.exec(line);
    if (!m) return null;
    items.push(mdInline(m[1]));
  }
  const para = (s) => (!s.body || /\n\s*\n/.test(s.body) || /^([-*] |\d+\. |```|\|)/m.test(s.body) ? null : mdInline(s.body.replace(/\n/g, ' ')));
  const rest = parts.slice(i + 1, i + 4).map(para);
  if (!items.length || rest.some((x) => x === null)) return null;
  return [
    {r: 'contrib5', h: parts[i].h, b: [{t: 'ol', v: items}]},
    {r: 'issues', h: parts[i + 1].h, b: [{t: 'p', v: rest[0]}]},
    {r: 'license', h: parts[i + 2].h, b: [{t: 'p', v: rest[1]}]},
    {r: 'support', h: parts[i + 3].h, b: [{t: 'p', v: rest[2]}]}
  ];
}
const SECS_ROLES = 'contrib5,issues,license,support';
export function syncD(root, D, cfg) {
  D.ver = cfg.version;
  if (D.kind === 'data' && D.secs && typeof D.secs === 'object') {
    for (const lang of Object.keys(D.secs)) {
      const file = lang === 'en' ? 'README.md' : 'README.' + lang + '.md';
      if (!exists(root, file) || !Array.isArray(D.secs[lang]) || D.secs[lang].map((s) => s.r).join() !== SECS_ROLES) continue;
      const secs = secsFromReadme(rd(root, file));
      if (secs) D.secs[lang] = secs;
    }
  }
  if (exists(root, 'good-first-issues.txt')) {
    const old = new Map((D.tasks || []).map((t) => [t.t, t.l]));
    D.tasks = rd(root, 'good-first-issues.txt').split('\n').map((s) => s.trim()).filter(Boolean).map((t) => ({t, l: old.get(t) || []}));
  }
  if (D.kind === 'data') {
    D.nfiles = listJson(path.join(root, 'data')).length;
    if (exists(root, 'schema.json')) D.schema = JSON.parse(rd(root, 'schema.json'));
    // exemplul din vitrină = șablonul din directorul de date (example.json), ca să nu rămână un exemplu vechi în pagină
    const ex = cfg.data ? path.join(cfg.data, 'example.json') : '';
    if (ex && exists(root, ex)) D.example = JSON.parse(rd(root, ex));
  }
  return D;
}

/* ---------------- hash-uri CSP pentru <style> și <script> ---------------- */
export function recomputeStyleHashes(html) {
  const m = html.match(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/i);
  if (!m) return html;
  const cm = m[0].match(/content=("([^"]*)"|'([^']*)')/i);
  const content = cm[2] ?? cm[3];
  const sm = content.match(/(^|;\s*)style-src([^;]*)/);
  if (!sm) return html;
  const blocks = [];
  const bare = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  const re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let x;
  while ((x = re.exec(bare))) if (x[1].trim()) blocks.push(`'sha256-${sha64(x[1])}'`);
  const hashes = [...new Set(blocks)];
  const kept = sm[2].replace(/\s*'sha256-[^']+'/g, '').trim();
  const nd = `style-src${kept ? ' ' + kept : ''}${hashes.length ? ' ' + hashes.join(' ') : ''}`;
  const nc = content.replace(/(^|;\s*)style-src[^;]*/, (_, p) => p + nd);
  if (nc === content) return html;
  return html.replace(m[0], () => m[0].replace(cm[0], `content=${cm[1][0]}${nc}${cm[1][0]}`));
}

/** Blocurile <style> inline ale paginii al căror hash lipsește din style-src (când style-src nu permite 'unsafe-inline'): browserul le-ar bloca. Listă goală = în regulă. */
export function missingStyleHashes(html) {
  const m = html.match(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/i);
  if (!m) return [];
  const cm = m[0].match(/content=("([^"]*)"|'([^']*)')/i);
  const content = cm[2] ?? cm[3];
  const sm = content.match(/(^|;\s*)style-src([^;]*)/) || content.match(/(^|;\s*)default-src([^;]*)/);   // sursa efectivă: style-src, altfel default-src
  if (!sm || /'unsafe-inline'/.test(sm[2])) return [];
  const have = new Set(sm[2].match(/'sha256-[^']+'/g) || []);
  const bare = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '');
  const miss = [];
  for (const x of bare.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)) {
    if (x[2].trim() && !have.has(`'sha256-${sha64(x[2])}'`)) miss.push((x[1].match(/\bid=["']([^"']+)["']/) || [])[1] || '(fără id)');
  }
  return miss;
}

/* ---------------- CSP: gazde declarate și jetoane suplimentare ---------------- */
const CSP_TOKEN = /^('self'|[a-z][a-z0-9+.-]*:|https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:\d{1,5})?)$/;
/** Aplică «connect» și «csp» din src/app.json peste CSP-ul paginii (idempotent). Fără ele întoarce pagina neschimbată. Aruncă la jetoane neacceptate. */
export function applyCspExtras(html, cfg) {
  const extras = {};
  if (cfg.connect !== undefined) {
    if (!Array.isArray(cfg.connect) || !cfg.connect.length) throw new Error('src/app.json: «connect» trebuie să fie o listă de origini https');
    cfg.connect.forEach((o) => { if (!/^https:\/\//.test(o) || !CSP_TOKEN.test(o)) throw new Error(`src/app.json: «connect» acceptă doar origini https fără cale (am găsit «${o}»)`); });
    extras['connect-src'] = cfg.connect.slice();
  }
  if (cfg.csp !== undefined) {
    if (!cfg.csp || typeof cfg.csp !== 'object' || Array.isArray(cfg.csp)) throw new Error('src/app.json: «csp» trebuie să fie un obiect {directivă: [jetoane]}');
    for (const [k, v] of Object.entries(cfg.csp)) {
      if (!/^[a-z-]+-src$/.test(k) || k === 'script-src' || k === 'style-src' || k === 'default-src') throw new Error(`src/app.json: directiva «${k}» nu poate fi schimbată din «csp»`);
      if (!Array.isArray(v) || !v.length) throw new Error(`src/app.json: «csp.${k}» trebuie să fie o listă de jetoane`);
      v.forEach((t) => { if (!CSP_TOKEN.test(t)) throw new Error(`src/app.json: jeton CSP neacceptat «${t}» în «${k}»`); });
      extras[k] = (extras[k] || []).concat(v);
    }
  }
  if (!Object.keys(extras).length) return html;
  const m = html.match(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/i);
  if (!m) throw new Error('index.html: nu găsesc eticheta Content-Security-Policy');
  const cm = m[0].match(/content=("([^"]*)"|'([^']*)')/i);
  const q = cm[1][0], content = cm[2] !== undefined ? cm[2] : cm[3];
  const dirs = content.split(';').map((x) => x.trim()).filter(Boolean).map((x) => x.split(/\s+/));
  for (const [name, toks] of Object.entries(extras)) {
    const d = dirs.find((x) => x[0].toLowerCase() === name);
    if (d) { for (let i = d.length - 1; i >= 1; i--) if (d[i] === "'none'") d.splice(i, 1); toks.forEach((t) => { if (!d.includes(t)) d.push(t); }); }
    else dirs.push([name, ...toks]);
  }
  const nc = dirs.map((d) => d.join(' ')).join('; ');
  if (nc === content) return html;
  return html.replace(m[0], () => m[0].replace(cm[0], () => `content=${q}${nc}${q}`));
}

/* ---------------- injectare ---------------- */
const APP_STYLE_RE = /<style id="app-style">[\s\S]*?<\/style>\n?/;
const APP_JS_RE = /<script id="app-js">[\s\S]*?<\/script>\n?/;
const SB_JS_RE = /<script type="text\/x-fff-sandbox" id="w-[a-z0-9-]+"[^>]*>[\s\S]*?<\/script>\n?/g;
const SB_CSS_RE = /<style id="w-css"[^>]*>[\s\S]*?<\/style>\n?/;
export function inject(html, root, built) {
  let out = html.replace(APP_STYLE_RE, '').replace(APP_JS_RE, '').replace(SB_JS_RE, '').replace(SB_CSS_RE, '');
  const styles = (built.css.trim() ? `<style id="app-style">${built.css}</style>\n` : '') + (built.sandbox ? sandboxCssHtml(built.sandbox) : '');
  if (styles) {
    const pw = out.indexOf('<!--fff:pwa:start');   // blocul PWA (dacă există) rămâne ultimul din <head>: stilul aplicației se pune înaintea lui
    if (pw >= 0) out = out.slice(0, pw) + styles + out.slice(pw);
    else if (/<\/style>\s*<\/head>/.test(out)) out = out.replace(/<\/style>(\s*<\/head>)/, (_, tail) => `</style>\n${styles.replace(/\n$/, '')}${tail}`);
    else out = out.replace('</head>', () => `${styles}</head>`);
  }
  const marker = '<script>(function(){\n"use strict";\nvar D=';
  if (!out.includes(marker)) throw new Error('index.html: nu găsesc scriptul paginii-vitrină (marcajul «var D=»)');
  out = out.replace(marker, () => `${built.sandbox ? sandboxHtml(built.sandbox) : ''}<script id="app-js">${built.js}</script>\n${marker}`);
  out = patchShellScript(out);
  const sh = parseShell(out);
  syncD(root, sh.D, built.cfg);
  out = serializeShell(sh);
  // meta-uri de versiune
  const setMeta = (h, name, val) => {
    const re = new RegExp(`<meta name="${name}" content="[^"]*">`);
    const tag = `<meta name="${name}" content="${val}">`;
    if (re.test(h)) return h.replace(re, tag);
    return h.replace('<meta name="viewport"', (m0) => `${tag}\n${m0}`);
  };
  out = setMeta(out, 'application-version', built.cfg.version);
  out = setMeta(out, 'last-updated', built.cfg.updated);
  const verText = `v ${built.cfg.version} · ${built.cfg.updated}`;
  if (/\bid="app-version"/.test(out)) out = out.replace(/(<span id="app-version">)[^<]*(<\/span>)/, (_, a, b) => a + verText + b);
  else {
    const gh = /(<a href="https:\/\/github\.com\/chiuta\/[^"]+"[^>]*>GitHub<\/a>)(<\/p>\s*<\/footer>)/;
    if (!gh.test(out)) throw new Error('index.html: nu găsesc subsolul cu linkul GitHub pentru #app-version');
    out = out.replace(gh, (_, a, b) => `${a} · <span id="app-version">${verText}</span>${b}`);
  }
  return recomputeStyleHashes(out);
}

/** Argumentele pentru `fff-kit/pwa/pwa.mjs apply` din secțiunea opțională «pwa» a lui src/app.json (null = fără PWA). */
export function pwaArgs(cfg) {
  const p = cfg && cfg.pwa;
  if (!p) return null;
  const a = ['--slug', cfg.slug];
  for (const k of ['name', 'short', 'theme', 'bg', 'mono', 'scope']) if (p[k]) a.push('--' + k, String(p[k]));
  if (Array.isArray(p.categories) && p.categories.length) a.push('--categories', p.categories.join(','));
  return a;
}

function findKit(root, argKit) {
  const cands = [argKit, process.env.FFF_KIT, path.join(root, '..', 'chiuta.github.io', 'fff-kit'), path.join(root, 'fff-kit')].filter(Boolean);
  for (const c of cands) if (fs.existsSync(path.join(c, 'build.mjs'))) return c;
  return null;
}

export async function build(root, opts = {}) {
  const file = path.join(root, 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  const built = await compose(root);
  const cfg = JSON.parse(rd(root, 'src/app.json'));
  const out = applyCspExtras(inject(html, root, built), cfg);
  const pwa = pwaArgs(cfg);
  if (opts.check) {
    // compară doar părțile determinate de src/: blocurile app-*, ancorele și D
    const norm = (h) => h.replace(/ data-fff-hash="[0-9a-f]*"/, '').replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/i, '');
    const res = {ok: norm(out) === norm(html), html: out, pwa: null, csp: missingStyleHashes(html).length === 0};
    if (!res.csp) res.ok = false;   // CSP-ul din fișier are hash-uri de stil învechite (browserul ar bloca stilul): rulează node scripts/build.mjs
    // PWA: dacă src/app.json o cere și kitul e găsit, fișierele alăturate trebuie să fie la zi (manifest, sw.js cu versiunea paginii, CSP)
    const kit = pwa && !opts.noKit ? findKit(root, opts.kit) : null;
    if (kit && fs.existsSync(path.join(kit, 'pwa', 'pwa.mjs'))) {
      const r = spawnSync(process.execPath, [path.join(kit, 'pwa', 'pwa.mjs'), 'check', root], {encoding: 'utf8'});
      let j = null; try { j = JSON.parse(r.stdout); } catch { /* ieșire neașteptată */ }
      res.pwa = {ok: r.status === 0, problems: j && j.problems ? j.problems : [(r.stderr || r.stdout || '').trim().slice(0, 300)]};
      if (!res.pwa.ok) res.ok = false;
    }
    return res;
  }
  if (out !== html) fs.writeFileSync(file, out);
  const res = {ok: true, changed: out !== html, kit: null, pwa: null};
  if (!opts.noKit) {
    const kit = findKit(root, opts.kit);
    if (kit) {
      const r = spawnSync(process.execPath, [path.join(kit, 'build.mjs'), 'fixcsp', root], {encoding: 'utf8'});
      if (r.status !== 0) throw new Error('fixcsp a eșuat: ' + (r.stderr || r.stdout));
      res.kit = kit;
      if (pwa && fs.existsSync(path.join(kit, 'pwa', 'pwa.mjs'))) {
        // pictogramele existente se păstrează (fără Playwright); la prima rulare se generează
        const icons = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'].every((f) => fs.existsSync(path.join(root, f)));
        const p = spawnSync(process.execPath, [path.join(kit, 'pwa', 'pwa.mjs'), 'apply', root, ...pwa, ...(icons ? ['--no-icons'] : [])], {encoding: 'utf8'});
        if (p.status !== 0) throw new Error('pwa apply a eșuat: ' + (p.stderr || p.stdout).trim().slice(0, 600));
        let j = null; try { j = JSON.parse(p.stdout); } catch { /* ieșire neașteptată */ }
        res.pwa = j ? {changed: !!j.changed} : {changed: null};
        if (j && j.changed) res.changed = true;
      }
      // kitul poate readuce un style-src din marcajul PWA (hash-urile de la prima aplicare); ultimul cuvânt la hash-urile de stil îl are constructorul
      const fin = fs.readFileSync(file, 'utf8');
      if (missingStyleHashes(fin).length) { fs.writeFileSync(file, recomputeStyleHashes(fin)); res.changed = true; }
    }
  }
  return res;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const opts = {check: args.includes('--check'), noKit: args.includes('--no-kit'), kit: args.includes('--kit') ? args[args.indexOf('--kit') + 1] : null};
  build(root, opts).then((r) => {
    if (opts.check) {
      console.log(r.ok ? 'build --check: index.html corespunde cu src/' + (r.pwa ? ' · PWA la zi' : '') : 'build --check: index.html NU corespunde cu src/' + (r.pwa && !r.pwa.ok ? ' (PWA: ' + r.pwa.problems.join('; ') + ')' : '') + (r.csp === false ? ' (hash-uri CSP de stil învechite: browserul ar bloca stilul aplicației)' : '') + ' (rulează node scripts/build.mjs)');
      process.exit(r.ok ? 0 : 1);
    }
    console.log(`build ok${r.changed ? ' (index.html rescris)' : ' (neschimbat)'}${r.kit ? ' · kit: ' + r.kit : ' · kitul nu a fost găsit: rulează «node <fff-kit>/build.mjs fixcsp .» pentru eticheta de integritate'}`);
  }).catch((e) => { console.error('build: ' + e.message); process.exit(1); });
}
