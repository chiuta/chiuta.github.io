#!/usr/bin/env node
// hub-i18n — interfața hubului chiuta.ro în limbile din data/limbi.json, fără dependențe externe.
//
//   node tools/i18n25/hub-i18n.mjs check [--lang xx]    validează data/hub-i18n/<limbă>.json față de sursa engleză (chei, marcaje, script, lungimi)
//   node tools/i18n25/hub-i18n.mjs apply                 (re)generează în index.html blocul /*i18n25*/ din fișierele valide; idempotent
//   node tools/i18n25/hub-i18n.mjs status                ce limbi sunt livrate în pagină și ce lipsește
//
// Fișier de limbă (data/hub-i18n/<cod>.json): {lang, T:{…112 șiruri…}, tpl:{nProjects, nShown, labNote, covLangs, covOnly, covPart, covScore, statAppsTip, statSecTip},
//   CTRL:{…}, sections:{<secțiune>:{title,intro}}, misc:{…}}. Sursa de lucru: data/hub-i18n/_source.en.json (generată de extract-hub-source.mjs).
// Textele cardurilor aplicațiilor (CONTENT.<limbă>.apps) NU sunt în aceste fișiere: pentru limbile noi lipsesc și pagina folosește engleza,
// cheie cu cheie (applyContent). Traducerile sunt asistate de IA și nu au fost revizuite de vorbitori nativi (data/limbi.json → confidence).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = path.join(HUB, 'data', 'hub-i18n');
const reg = JSON.parse(fs.readFileSync(path.join(HUB, 'data', 'limbi.json'), 'utf8'));
const src = JSON.parse(fs.readFileSync(path.join(DIR, '_source.en.json'), 'utf8'));
const cmd = process.argv[2] || 'status';
const only = process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : null;
const CORE = ['en', 'ro', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
const NEW = reg.order.filter((l) => !CORE.includes(l));

// ---------- validare ----------
const PH = /\{[a-z]+\}/g;
const BRANDS = ['OSATURA', 'VERIGA', 'TEZAUR', 'LegatorOCR', 'Alexandru-Ionuț Chiuță', 'README', 'SemVer', 'MAJOR.MINOR.PATCH', 'GitHub'];
const SCRIPT = {Cyrl: /[Ѐ-ӿ]/g, Grek: /[Ͱ-Ͽἀ-῿]/g, Armn: /[԰-֏]/g, Hebr: /[֐-׿]/g, Latn: /[A-Za-zÀ-ɏ]/g};
const LATIN_LETTER = /[A-Za-zÀ-ɏ]/g;
const KEEP_LATIN = [...BRANDS, 'ro, en, fr, it, es, pt, de, hu', '-alpha', 'GPS', 'API', 'PDF', 'HTML', 'Rust', 'Belot', 'RO', 'OCR', 'Offline-First', 'Single-file', 'Alexio', 'ENIC'].map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
const stripLatin = (t) => t.replace(new RegExp(KEEP_LATIN.join('|'), 'g'), '');
function checkLang(l) {
  const f = path.join(DIR, `${l}.json`);
  if (!fs.existsSync(f)) return {l, exists: false, errors: [], warns: []};
  const errors = [], warns = [];
  let d; try { d = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return {l, exists: true, errors: ['JSON invalid: ' + e.message], warns}; }
  if (d.lang !== l) errors.push(`câmpul lang = ${d.lang}, așteptat ${l}`);
  const meta = reg.languages[l];
  const cmp = (name, a, b, long = 40) => {
    for (const k of Object.keys(a)) if (!(k in b)) errors.push(`${name}.${k}: lipsește`);
    for (const k of Object.keys(b)) if (!(k in a)) errors.push(`${name}.${k}: cheie în plus`);
    for (const k of Object.keys(a)) {
      const s = a[k], t = b[k];
      if (typeof t !== 'string') { if (k in b) errors.push(`${name}.${k}: nu e șir`); continue; }
      if (!t.trim()) { errors.push(`${name}.${k}: gol`); continue; }
      const ps = (s.match(PH) || []).sort().join(), pt = (t.match(PH) || []).sort().join();
      if (ps !== pt) errors.push(`${name}.${k}: marcaje ${ps || '∅'} ≠ ${pt || '∅'}`);
      for (const n of (s.match(/\d+(?:\.\d+)*/g) || [])) if (!t.includes(n)) { warns.push(`${name}.${k}: numărul ${n} lipsește`); break; }
      for (const b2 of BRANDS) if (s.includes(b2) && !t.includes(b2)) errors.push(`${name}.${k}: „${b2}” trebuie păstrat`);
      if (/[ăĂțȚșȘ]/.test(t.replace(/Alexandru-Ionuț Chiuță/g, '')) && !['rmy'].includes(l)) warns.push(`${name}.${k}: litere românești în text`);
      if (s.length > long) {
        const r = t.length / s.length;
        if (r > 2.6 || r < 0.35) warns.push(`${name}.${k}: lungime ${r.toFixed(2)}× față de engleză`);
        if (meta.script !== 'Latn') {
          const u = stripLatin(t), sc = (u.match(SCRIPT[meta.script]) || []).length, lat = (u.match(LATIN_LETTER) || []).length;
          if (sc < lat) errors.push(`${name}.${k}: puține litere ${meta.script} (${sc}) față de latine (${lat})`);
        } else if (t === s) errors.push(`${name}.${k}: identic cu engleza`);
      }
    }
  };
  cmp('T', src.T, d.T || {});
  cmp('tpl', src.tpl, d.tpl || {}, 12);
  cmp('CTRL', src.CTRL, d.CTRL || {}, 12);
  cmp('misc', src.misc, d.misc || {}, 12);
  for (const k of Object.keys(src.sections)) {
    const s = src.sections[k], t = (d.sections || {})[k];
    if (!t) { errors.push(`sections.${k}: lipsește`); continue; }
    cmp(`sections.${k}`, s, t);
  }
  for (const k of Object.keys(d.sections || {})) if (!src.sections[k]) errors.push(`sections.${k}: cheie în plus`);
  if (meta.dir === 'rtl' && !(JSON.stringify(d).match(SCRIPT.Hebr))) errors.push('limbă RTL fără litere ebraice');
  // data din subsol: `dateFmt` cu {d} (zi), {y} (an) și {m} (nume de lună din `months`) sau {n} (număr de lună).
  // Tabelele proprii înlocuiesc toLocaleDateString acolo unde Chromium/ICU nu are date de locale (hy, sq, mk, yi) sau
  // unde locala apropiată ar da luni greșite (crh, rue); la rmy și rue formatul e numeric, ca să nu inventez nume de luni.
  if ('months' in d || 'dateFmt' in d) {
    if (typeof d.dateFmt !== 'string' || !/\{d\}/.test(d.dateFmt) || !/\{y\}/.test(d.dateFmt)) errors.push('dateFmt: lipsește sau nu conține {d} și {y}');
    else if (/\{m\}/.test(d.dateFmt) && !(Array.isArray(d.months) && d.months.length === 12 && d.months.every((x) => typeof x === 'string' && x.trim()))) errors.push('months: {m} cere 12 nume de luni');
    else if (!/\{[mn]\}/.test(d.dateFmt)) errors.push('dateFmt: lipsește {m} sau {n}');
    if (Array.isArray(d.months) && d.months.some((x) => typeof x === 'string' && x !== x.normalize('NFC'))) errors.push('months: nu sunt în forma NFC');
  }
  return {l, exists: true, errors, warns};
}

// ---------- aplicare în index.html ----------
const FLAG = {uk: '🇺🇦', tr: '🇹🇷', ru: '🇷🇺', sr: '🇷🇸', sk: '🇸🇰', bg: '🇧🇬', hr: '🇭🇷', el: '🇬🇷', cs: '🇨🇿', pl: '🇵🇱', hy: '🇦🇲', sq: '🇦🇱', mk: '🇲🇰', rmy: '🌐', crh: '🌐', yi: '🌐', rue: '🌐'};
const LOCALE = {uk: 'uk-UA', tr: 'tr-TR', ru: 'ru-RU', sr: 'sr-Cyrl-RS', sk: 'sk-SK', bg: 'bg-BG', hr: 'hr-HR', el: 'el-GR', cs: 'cs-CZ', pl: 'pl-PL', hy: 'hy-AM', sq: 'sq-AL', mk: 'mk-MK', yi: 'yi', rmy: 'en-GB', crh: 'tr-TR', rue: 'uk-UA'};
const BEGIN = '/*i18n25:begin*/', END = '/*i18n25:end*/', UBEGIN = '/*i18n25:ui:begin*/', UEND = '/*i18n25:ui:end*/';

function replaceOnce(s, from, to, label) {
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(`ancoră „${label}”: ${n} potriviri (așteptat 1)`);
  return s.replace(from, () => to);
}

function applyPage() {
  const ok = [];
  for (const l of NEW) { const r = checkLang(l); if (r.exists && !r.errors.length) ok.push(l); else if (r.exists) console.error(`omis ${l}: ${r.errors.length} erori (rulează check)`); }
  const ui = [...CORE, ...ok];
  const file = path.join(HUB, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  // 1) lista limbilor interfeței, înaintea lui curLang
  const uiList = `${UBEGIN}const UI_LANGS=${JSON.stringify(ui)};${UEND}`;
  if (html.includes(UBEGIN)) html = html.replace(new RegExp(UBEGIN.replace(/[/*:]/g, '\\$&') + '[\\s\\S]*?' + UEND.replace(/[/*:]/g, '\\$&')), () => uiList);
  else html = replaceOnce(html, "const CONTENT_LANGS=['en','ro','fr','it','es','pt','de','hu'];", `const CONTENT_LANGS=['en','ro','fr','it','es','pt','de','hu'];\n${uiList}`, 'CONTENT_LANGS');
  html = html.replace("if(!CONTENT_LANGS.includes(curLang)) curLang='en';", "if(!UI_LANGS.includes(curLang)) curLang='en';");
  // 2) LOCALES (formatul datelor) — extins cu limbile noi
  const loc = JSON.stringify(Object.fromEntries(ui.map((l) => [l, ({en: 'en-GB', ro: 'ro-RO', fr: 'fr-FR', it: 'it-IT', es: 'es-ES', pt: 'pt-PT', de: 'de-DE', hu: 'hu-HU'})[l] || LOCALE[l]]))).replace(/"([a-z]+)":/g, '$1:').replace(/"/g, "'");
  html = html.replace(/const LOCALES=\{[^}]*\};/, () => `const LOCALES=${loc};`);
  // 3) RTL (idiș) la schimbarea limbii
  const rtl = reg.order.filter((l) => reg.languages[l].dir === 'rtl' && ui.includes(l));
  if (!html.includes('/*i18n25:dir*/')) html = replaceOnce(html, '  document.documentElement.lang = lang;\n', `  document.documentElement.lang = lang;\n  /*i18n25:dir*/document.documentElement.dir = ${JSON.stringify(rtl)}.indexOf(lang) > -1 ? 'rtl' : 'ltr';\n`, 'documentElement.lang');
  else html = html.replace(/\/\*i18n25:dir\*\/document\.documentElement\.dir = [^;]*;/, () => `/*i18n25:dir*/document.documentElement.dir = ${JSON.stringify(rtl)}.indexOf(lang) > -1 ? 'rtl' : 'ltr';`);
  // 4) rezervă pe engleză, cheie cu cheie, în applyContent
  if (!html.includes('/*i18n25:fb*/')) {
    html = replaceOnce(html,
      "    let v=C; for(const k of el.dataset.c.split('|')){ v=v&&v[k]; }\n    if(typeof v==='string'){ el.textContent=v; el.lang=lang;",
      "    let v=C, fb=false; for(const k of el.dataset.c.split('|')){ v=v&&v[k]; }\n    /*i18n25:fb*/if(typeof v!=='string'&&C!==CONTENT.en){ v=CONTENT.en; fb=true; for(const k of el.dataset.c.split('|')){ v=v&&v[k]; } }\n    if(typeof v==='string'){ el.textContent=v; el.lang=fb?'en':lang;", 'applyContent');
  }
  // 5) dicționarele limbilor noi
  const data = {};
  for (const l of ok) {
    const d = JSON.parse(fs.readFileSync(path.join(DIR, `${l}.json`), 'utf8'));
    data[l] = {T: d.T, tpl: d.tpl, CTRL: d.CTRL, sections: d.sections, misc: d.misc, name: reg.languages[l].name, flag: FLAG[l], label: l.toUpperCase(), loc: LOCALE[l], ...(d.dateFmt ? {dateFmt: d.dateFmt} : {}), ...(d.months ? {months: d.months} : {})};
  }
  // 5b) descrierile aplicațiilor (parțiale sunt permise): data/hub-i18n/apps/<limbă>.json → i18n/hub-apps.<limbă>.js
  const appLangs = [];
  const EN = JSON.parse(html.match(/const CONTENT=(\{[\s\S]*?\});\nfunction applyContent/)[1]).en.apps;
  const outDir = path.join(HUB, 'i18n');
  for (const l of ok) {
    const f = path.join(DIR, 'apps', `${l}.json`);
    if (!fs.existsSync(f)) continue;
    const src = JSON.parse(fs.readFileSync(f, 'utf8')).apps, out = {}, errs = [];
    for (const [k, v] of Object.entries(src)) {
      if (!EN[k]) { errs.push(`${k}: nu există în catalog`); continue; }
      const o = {};
      if (v.line !== undefined) { if (typeof v.line !== 'string' || v.line.length < 10) errs.push(`${k}.line`); else o.line = v.line.normalize('NFC'); }
      if (v.detail !== undefined) { if (typeof v.detail !== 'string' || v.detail.length < 10) errs.push(`${k}.detail`); else o.detail = v.detail.normalize('NFC'); }
      if (v.tags !== undefined) { if (!Array.isArray(v.tags) || v.tags.length !== EN[k].tags.length || v.tags.some((t) => typeof t !== 'string' || !t)) errs.push(`${k}.tags (trebuie ${EN[k].tags.length})`); else o.tags = v.tags.map((t) => t.normalize('NFC')); }
      out[k] = o;
    }
    if (errs.length) { console.error(`descrieri ${l}: ${errs.length} erori → omis\n   ` + errs.slice(0, 10).join('\n   ')); process.exitCode = 1; continue; }
    fs.mkdirSync(outDir, {recursive: true});
    fs.writeFileSync(path.join(outDir, `hub-apps.${l}.js`), `/* generat de tools/i18n25/hub-i18n.mjs din data/hub-i18n/apps/${l}.json — nu edita de mână */\n__hubApps(${JSON.stringify(l)},${JSON.stringify(out).replace(/</g, '\\u003c')});\n`);
    appLangs.push(l);
    const n = Object.keys(EN).length, c = (fld) => Object.values(out).filter((x) => x[fld]).length;
    console.log(`descrieri ${l}: rânduri ${c('line')}/${n} · etichete ${c('tags')}/${n} · detalii ${c('detail')}/${n}`);
  }
  const block = `${BEGIN}
(function(){
  var N=${JSON.stringify(data)};
  function rep(s,m){ return String(s).replace(/\\{([a-z]+)\\}/g,function(x,k){ return m[k]!==undefined?m[k]:x; }); }
  function en(){ var c=T.en.copyright||'', m=/(\\d+) (\\w+) (\\d{4})/.exec(c); return m?new Date(m[2]+' '+m[1]+', '+m[3]+' 12:00:00 UTC'):null; }
  function fmt(x){ var d=en(); if(!d||isNaN(d)) return ''; if(x.dateFmt) return rep(x.dateFmt,{d:d.getUTCDate(),n:d.getUTCMonth()+1,y:d.getUTCFullYear(),m:x.months?x.months[d.getUTCMonth()]:''}); try{ return d.toLocaleDateString(x.loc,{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}); }catch(e){ return d.toISOString().slice(0,10); } }
  Object.keys(N).forEach(function(l){
    var x=N[l], t=Object.assign({}, x.T), p=x.tpl;
    t.copyright=rep(t.copyright,{d:fmt(x)});
    t.nProjects=function(n){ return rep(p.nProjects,{n:n}); };
    t.nShown=function(n){ return function(m){ return rep(p.nShown,{n:n,m:m}); }; };
    t.labNote=function(s){ return rep(p.labNote,{s:s}); };
    t.covLangs=function(n){ return rep(p.covLangs,{n:n}); };
    t.covOnly=function(a){ return rep(p.covOnly,{l:a}); };
    t.covPart=function(n){ return rep(p.covPart,{n:n}); };
    t.covScore=function(n){ return rep(p.covScore,{n:n}); };
    t.statAppsTip=function(n,a,v){ return rep(p.statAppsTip,{n:n,l:a,v:v}); };
    t.statSecTip=function(n){ return rep(p.statSecTip,{n:n}); };
    T[l]=t; CTRL[l]=x.CTRL; CONTENT[l]={sections:x.sections,misc:x.misc};
    LANG_META.push({id:l,label:x.label,flag:x.flag,name:x.name});
  });
  /* descrierile aplicațiilor pentru limbile noi: fișiere separate (i18n/hub-apps.<limbă>.js), încărcate ca <script> doar la cerere
     (CSP: script-src 'self'; connect-src rămâne 'none'). Până sosesc, și pentru orice cheie lipsă, rămâne engleza. */
  var AV=${JSON.stringify(appLangs)}, asked={}, base=applyContent;
  window.__hubApps=function(l,apps){ if(N[l]&&CONTENT[l]){ CONTENT[l].apps=apps; if(curLang===l){ try{ base(l); }catch(_){} } } };
  applyContent=function(lang){
    base(lang);
    if(AV.indexOf(lang)>-1&&!CONTENT[lang].apps&&!asked[lang]){ asked[lang]=1; var s=document.createElement('script'); s.src='i18n/hub-apps.'+lang+'.js'; s.async=true; document.head.appendChild(s); }
  };
})();
${END}
`;
  // blocul NU stă între `const CONTENT=…;` și `function applyContent` (sync-catalog.mjs caută exact acea secvență),
  // ci după definiția lui applyContent, înaintea ascultătorului DOMContentLoaded.
  const reBlock = new RegExp(BEGIN.replace(/[/*:]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[/*:]/g, '\\$&') + '\\n');
  html = html.replace(reBlock, '');
  const DCL = "window.addEventListener('DOMContentLoaded',function(){try{applyContent(curLang)}catch(_){}});";
  html = replaceOnce(html, DCL, `${block}${DCL}`, 'DOMContentLoaded applyContent');
  // 5c) asistentul de descoperire (DD) și insigna „NOU” pentru limbile noi: data/hub-i18n/dd/<limbă>.json
  {
    const DDB = '/*i18n25:dd:begin*/', DDE = '/*i18n25:dd:end*/';
    const dd = {}, newl = {};
    const enDD = JSON.parse(fs.readFileSync(path.join(DIR, 'dd', '_en.json'), 'utf8'));
    for (const l of ok) {
      const f = path.join(DIR, 'dd', `${l}.json`);
      if (!fs.existsSync(f)) continue;
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      const out = {};
      for (const [k, v] of Object.entries(j.DD || {})) {
        if (!(k in enDD) || typeof v !== 'string' || !v) continue;
        const ph = (x) => (x.match(/\{\d+\}/g) || []).sort().join();
        if (ph(v) !== ph(enDD[k])) { console.error(`dd ${l}.${k}: substituenții nu se potrivesc → omis`); process.exitCode = 1; continue; }
        out[k] = v.normalize('NFC');
      }
      dd[l] = out;
      if (j.NEW) newl[l] = j.NEW;
    }
    // sursa generată pentru asistent: tools/discover/i18n25.js (inclus în index.html de tools/build-discover.mjs — rulează-l după `apply`)
    fs.writeFileSync(path.join(HUB, 'tools', 'discover', 'i18n25.js'), `/* generat de tools/i18n25/hub-i18n.mjs din data/hub-i18n/dd/*.json — nu edita de mână */\nObject.assign(DD,${JSON.stringify(dd).replace(/</g, '\\u003c')});\n`);
    html = html.replace(new RegExp(DDB.replace(/[/*:]/g, '\\$&') + '[\\s\\S]*?' + DDE.replace(/[/*:]/g, '\\$&') + '\\n'), '');
    // bara de confort (hub-ux): data/hub-i18n/ux/<limbă>.json → tools/hub-ux/i18n25.js (inclus de tools/hub-ux/apply.mjs)
    {
      const ux = {};
      for (const l of ok) {
        const f = path.join(DIR, 'ux', `${l}.json`);
        if (fs.existsSync(f)) ux[l] = JSON.parse(fs.readFileSync(f, 'utf8'));
      }
      fs.writeFileSync(path.join(HUB, 'tools', 'hub-ux', 'i18n25.js'), `/* generat de tools/i18n25/hub-i18n.mjs din data/hub-i18n/ux/*.json — nu edita de mână */\n(function(X){ Object.keys(X).forEach(function(l){ Object.keys(X[l]).forEach(function(k){ if(S[k]) S[k][l]=X[l][k]; }); }); })(${JSON.stringify(ux).replace(/</g, '\\u003c')});\n`);
    }
    const nb = JSON.stringify(newl);
    if (!html.includes('/*i18n25:newl*/')) {
      html = replaceOnce(html, "NEWL[(document.documentElement.lang||'en').slice(0,2)]||'NEW'", "/*i18n25:newl*/(Object.assign(NEWL," + nb + "),NEWL[document.documentElement.lang]||NEWL[(document.documentElement.lang||'en').slice(0,2)]||'NEW')", 'NEWL');
    } else {
      html = html.replace(/\/\*i18n25:newl\*\/\(Object\.assign\(NEWL,[^)]*\),/, () => '/*i18n25:newl*/(Object.assign(NEWL,' + nb + '),');
    }
  }
  // 6) contorul „Limbi” din antet = limbile interfeței hubului
  html = html.replace(/(<div class="stat-value">)\d+(<span class="u">lang<\/span>)/, (m, a, b) => `${a}${ui.length}${b}`);
  fs.writeFileSync(file, html);
  console.log(`index.html: ${ui.length} limbi în interfață (${ok.length} noi: ${ok.join(' ') || '—'})`);
}

if (cmd === 'check') {
  let bad = 0;
  for (const l of NEW.filter((x) => !only || x === only)) {
    const r = checkLang(l);
    if (!r.exists) { console.log(`${l.padEnd(4)} lipsește`); continue; }
    if (r.errors.length) bad++;
    console.log(`${l.padEnd(4)} ${r.errors.length ? 'ERORI ' + r.errors.length : 'ok'}${r.warns.length ? ' · avertismente ' + r.warns.length : ''}`);
    r.errors.slice(0, 12).forEach((e) => console.log('   ✗ ' + e));
    if (only) r.warns.slice(0, 20).forEach((e) => console.log('   ! ' + e));
  }
  process.exit(bad ? 1 : 0);
} else if (cmd === 'apply') applyPage();
else {
  const have = NEW.filter((l) => checkLang(l).exists);
  const good = have.filter((l) => !checkLang(l).errors.length);
  console.log(`limbi noi: ${NEW.length} · fișiere: ${have.length} · valide: ${good.length}\nlipsesc: ${NEW.filter((l) => !have.includes(l)).join(' ') || '—'}`);
}
