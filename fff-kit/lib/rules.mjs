// fff-kit · rules — reguli euristice ale `build.mjs check` care citesc codul aplicației (fără blocul kit / fff-info):
//   native-dialog, unprefixed-storage, cdn-without-sri, i18n-parity.
// Toate lucrează pe textul paginii cu blocurile kitului înlocuite prin linii goale (numerele de linie rămân cele din fișier).
// Sunt EURISTICI (scanner de comentarii/șiruri, nu parser): chei sau apeluri construite dinamic nu se văd; falsele pozitive se
// suprimă justificat în fff.config.json → "exceptions": [{"rule": "...", "reason": "min. 8 caractere"}].
import {maskJs, inlineJsScripts, lineAt} from './jsscan.mjs';
import {analyzeI18n, describeIssue} from './i18n-parity.mjs';

export const NEW_RULES = ['native-dialog', 'unprefixed-storage', 'cdn-without-sri', 'i18n-parity'];

const KEY_WHITELIST = new Set(['lang', 'language', 'locale']);   // citite de FFF.lang() în comun cu hubul

/** Elimină comentariile HTML (păstrând liniile) ca marcajul comentat să nu declanșeze reguli. */
function stripHtmlComments(html) { return html.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' ')); }

/** Apeluri directe alert(/confirm(/prompt( în JS inline și în atribute on*="…". Metodele (x.confirm(…)) și definițiile nu contează; window.alert( contează. */
export function nativeDialogIssues(app) {
  const hits = [];
  const callRe = /(?<![\w$.])(?:(?:window|self|globalThis|top|parent)\s*\.\s*)?(alert|confirm|prompt)\s*\(/g;
  const defBefore = /(?:function\s*\*?\s*|\.\s*|get\s+|set\s+|async\s+|class\s+)$/;
  for (const sc of inlineJsScripts(app)) {
    const masked = maskJs(sc.body);
    let m;
    callRe.lastIndex = 0;
    while ((m = callRe.exec(masked))) {
      const before = masked.slice(Math.max(0, m.index - 20), m.index);
      if (/function\s*\*?\s*$/.test(before) || /\b(?:class|get|set|static)\s+$/.test(before)) continue;   // definiție
      // metodă de obiect/clasă:  confirm(msg) { … }
      let depth = 0, k = m.index + m[0].length - 1;
      for (; k < masked.length; k++) { if (masked[k] === '(') depth++; else if (masked[k] === ')') { depth--; if (!depth) break; } }
      if (/^\s*\{/.test(masked.slice(k + 1, k + 6)) && /[,{;}\n]\s*(?:async\s+)?$/.test(before)) continue;
      hits.push({name: m[1], line: lineAt(app, sc.start + m.index)});
    }
  }
  // atribute on*="…"
  const attrRe = /\son[a-z]+\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
  let a;
  const noScripts = app.replace(/<script\b[\s\S]*?<\/script\s*>/gi, (s) => s.replace(/[^\n]/g, ' '));
  while ((a = attrRe.exec(noScripts))) {
    const v = a[1] ?? a[2] ?? '';
    if (/(?<![\w$.])(?:window\s*\.\s*)?(?:alert|confirm|prompt)\s*\(/.test(v)) hits.push({name: 'on*', line: lineAt(app, a.index)});
  }
  if (!hits.length) return [];
  const names = [...new Set(hits.map((h) => h.name))].join('/');
  return [`native-dialog: ${hits.length} apeluri directe ${names}( (prima la linia ${hits[0].line}) — dialogurile native blochează firul, nu se traduc și nu se stilizează; folosește FFF.dialog.confirm/alert/prompt (modulul „dialog”)`];
}

/** Accept: <slug>(.|_|:|-|/), fff., sau prefixe din fff.config.json → storagePrefixes. */
function prefixesFor(slug, cfg) {
  const s = String(slug || '').toLowerCase();
  const list = new Set();
  if (s) { list.add(s); list.add(s.replace(/-(?:fara|fără)-.+$/, '')); list.add(s.replace(/[-_.]/g, '')); }
  for (const p of Array.isArray(cfg && cfg.storagePrefixes) ? cfg.storagePrefixes : []) if (typeof p === 'string' && p) list.add(p.toLowerCase());
  return [...list].filter(Boolean);
}
export function keyHasPrefix(key, slug, cfg) {
  const raw = String(key), k = raw.toLowerCase();
  if (k.startsWith('fff.') || KEY_WHITELIST.has(k) || /^_{1,2}[a-z0-9]{1,8}_{0,2}$/.test(k)) return true;   // + sonde de test (__t, _probe)
  // prefix urmat de separator (. _ : - /) sau de o majusculă/cifră (camelCase: acordajState)
  return prefixesFor(slug, cfg).some((p) => k.startsWith(p) && raw.length > p.length && (/[._:\-/]$/.test(p) || /[._:\-/]/.test(raw[p.length]) || /[A-Z0-9]/.test(raw[p.length])));
}
/** Chei literale din getItem/setItem/removeItem/localStorage['…'] și constante *KEY = '…' fără prefixul slugului. */
export function unprefixedStorageIssues(app, slug, cfg = {}) {
  const bad = new Map();   // cheie → prima linie
  const add = (key, line) => { if (!keyHasPrefix(key, slug, cfg) && !bad.has(key)) bad.set(key, line); };
  for (const sc of inlineJsScripts(app)) {
    const code = sc.body, masked = maskJs(code);
    let m;
    const re = /([\w$.]+)\s*\.\s*(?:getItem|setItem|removeItem)\s*\(\s*(["'`])(\x01*)\2/dg;
    while ((m = re.exec(masked))) {
      if (/sessionStorage$/i.test(m[1])) continue;
      const [s, e] = m.indices[3];
      const key = code.slice(s, e);
      if (key && !/\$\{/.test(key)) add(key, lineAt(app, sc.start + m.index));
    }
    const re2 = /\blocalStorage\s*\[\s*(["'`])(\x01*)\1\s*\]/dg;
    while ((m = re2.exec(masked))) { const [s, e] = m.indices[2]; const key = code.slice(s, e); if (key && !/\$\{/.test(key)) add(key, lineAt(app, sc.start + m.index)); }
    if (/localStorage/.test(masked)) {
      const re3 = /\b(?:var|let|const)\s+[A-Za-z_$]*KEY(?:_[A-Z0-9_]+)?\s*=\s*(["'])(\x01{3,60})\1/dg;
      while ((m = re3.exec(masked))) { const [s, e] = m.indices[2]; const key = code.slice(s, e); if (/^[A-Za-z][\w.:-]*$/.test(key)) add(key, lineAt(app, sc.start + m.index)); }
    }
  }
  if (!bad.size) return [];
  const list = [...bad.entries()];
  return [`unprefixed-storage: ${list.length} chei literale fără prefixul «${slug || 'slug'}.» (${list.slice(0, 5).map(([k, l]) => `${k}@${l}`).join(', ')}${list.length > 5 ? ', …' : ''}) — pe github.io aplicațiile împart originea; folosește FFF.store (modulul „store”) sau prefixează; migrare: FFF.store.migrate({vechi: 'nou'}). Chei construite dinamic nu sunt verificate`];
}

/** <script src> / <link rel=stylesheet|preload|modulepreload> extern fără integrity (+ script injectat cu .src literal extern fără .integrity). */
export function cdnWithoutSriIssues(app) {
  const html = stripHtmlComments(app);
  const bad = [];
  const ext = (u) => /^(?:https?:)?\/\//i.test(u) && !/^(?:https?:)?\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?:[:/]|$)/i.test(u);
  const tagRe = /<(script|link)\b([^>]*)>/gi;
  let m;
  while ((m = tagRe.exec(html))) {
    const tag = m[1].toLowerCase(), attrs = m[2];
    const url = ((tag === 'script' ? attrs.match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i) : attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)) || []).slice(1).find(Boolean);
    if (!url || !ext(url)) continue;
    if (tag === 'link') {
      const rel = (attrs.match(/\brel\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '';
      const as = (attrs.match(/\bas\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '';
      const sri = /^(?:stylesheet|modulepreload)$/i.test(rel) || (/^preload$/i.test(rel) && /^(?:script|style)$/i.test(as));
      if (!sri) continue;
    }
    if (/\bintegrity\s*=/i.test(attrs)) continue;
    bad.push({url, line: lineAt(html, m.index), tag});
  }
  for (const sc of inlineJsScripts(html)) {
    if (/\.integrity\s*=|setAttribute\(\s*['"]integrity/.test(sc.body)) continue;
    const masked = maskJs(sc.body), re = /\.src\s*=\s*(["'`])(\x01*)\1/dg;
    let k;
    while ((k = re.exec(masked))) {
      const [s, e] = k.indices[2], u = sc.body.slice(s, e);
      if (ext(u) && /createElement\(\s*['"]script['"]/.test(sc.body)) bad.push({url: u, line: lineAt(html, sc.start + k.index), tag: 'script(dinamic)'});
    }
  }
  if (!bad.length) return [];
  return [`cdn-without-sri: ${bad.length} resurse externe fără integrity (${bad.slice(0, 3).map((b) => `${b.url.length > 60 ? b.url.slice(0, 57) + '…' : b.url}@${b.line}`).join(', ')}${bad.length > 3 ? ', …' : ''}) — adaugă integrity="sha384-…" crossorigin="anonymous" sau include resursa în fișier (fără frontiere: preferabil)`];
}

/** Chei lipsă între limbi în dicționarele paginii (vezi lib/i18n-parity.mjs). */
export function i18nParityIssues(html) {
  let r;
  try { r = analyzeI18n(html, {used: false, includeKit: false}); } catch (e) { return []; }
  return r.issues.slice(0, 6).map((it) => 'i18n-parity: ' + describeIssue(it, 3));
}
