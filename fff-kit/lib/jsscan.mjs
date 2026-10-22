// fff-kit · jsscan — scanner euristic pentru JS inline: mascare comentarii/șiruri/regex, extragere scripturi, linii.
// Nu este un parser complet: tratează comentarii, șiruri, șabloane (cu ${…} imbricat) și literale regex (euristic, după context).
// Rezultatul `masked` are EXACT aceeași lungime ca intrarea: comentariile devin spații (cu \n păstrate), conținutul șirurilor/regex devine \x01 (caracter non-\w, ca regex-urile pe cod mascat să nu facă backtracking pe secvențe lungi).

const REGEX_PREV = /[(,=:\[!&|?{};+\-*%<>~^]$/;
const REGEX_KW = /(?:^|[^\w$.])(?:return|typeof|case|do|else|in|of|void|delete|throw|new|instanceof|yield|await)$/;

const _cache = new Map();
/** maskJs cu memorare (ultimele 6 texte): regulile succesive de pe aceeași pagină nu refac scanarea. */
export function maskJs(code) {
  if (_cache.has(code)) return _cache.get(code);
  const r = maskJsRaw(code);
  if (code.length > 2000) { _cache.set(code, r); if (_cache.size > 6) _cache.delete(_cache.keys().next().value); }
  return r;
}
function maskJsRaw(code) {
  const n = code.length, out = new Array(n);
  let i = 0;
  const stack = [];          // pentru șabloane: adâncimea acoladelor la intrarea în ${
  let braces = 0, lastSig = '';   // lastSig = ultimul text semnificativ (ultimele ~12 caractere non-spațiu) pentru euristica regex
  const put = (k, ch) => { out[k] = ch; };
  const keep = (ch) => { out[i] = ch; i++; };
  const sig = (ch) => { if (!/\s/.test(ch)) lastSig = (lastSig + ch).slice(-16); };
  function template() {   // i este pe caracterul de după „`” sau după „}” care închide ${…}
    for (; i < n;) {
      const c = code[i];
      if (c === '\\') { put(i, '\x01'); if (i + 1 < n) put(i + 1, code[i + 1] === '\n' ? '\n' : '\x01'); i += 2; continue; }
      if (c === '`') { keep('`'); sig('`'); return; }
      if (c === '$' && code[i + 1] === '{') { keep('$'); keep('{'); stack.push(braces); braces = 0; lastSig = '{'; return 'expr'; }
      put(i, c === '\n' ? '\n' : '\x01'); i++;
    }
  }
  let inTpl = 0;
  while (i < n) {
    const c = code[i], d = code[i + 1];
    if (c === '/' && d === '/') { while (i < n && code[i] !== '\n') { out[i] = ' '; i++; } continue; }
    if (c === '/' && d === '*') {
      while (i < n && !(code[i] === '*' && code[i + 1] === '/')) { out[i] = code[i] === '\n' ? '\n' : ' '; i++; }
      if (i < n) { out[i] = ' '; out[i + 1] = ' '; i += 2; }
      continue;
    }
    if (c === '"' || c === "'") {
      keep(c);
      while (i < n && code[i] !== c && code[i] !== '\n') {
        if (code[i] === '\\') { put(i, '\x01'); i++; if (i < n) { put(i, code[i] === '\n' ? '\n' : '\x01'); i++; } continue; }
        put(i, '\x01'); i++;
      }
      if (i < n && code[i] === c) keep(c);
      lastSig = (lastSig + c).slice(-16);
      continue;
    }
    if (c === '`') {
      keep('`');
      const r = template();
      if (r === 'expr') inTpl++;
      continue;
    }
    if (c === '{') { braces++; keep(c); sig(c); continue; }
    if (c === '}') {
      if (inTpl > 0 && braces === 0) {
        keep('}'); braces = stack.pop(); inTpl--;
        const r = template();
        if (r === 'expr') inTpl++;
        continue;
      }
      braces--; keep(c); sig(c); continue;
    }
    if (c === '/') {
      const prev = lastSig.trim();
      const isRe = prev === '' || REGEX_PREV.test(prev) || REGEX_KW.test(' ' + prev);
      if (isRe) {
        // caută închiderea pe aceeași linie
        let j = i + 1, cls = false, ok = false;
        for (; j < n && code[j] !== '\n'; j++) {
          const ch = code[j];
          if (ch === '\\') { j++; continue; }
          if (ch === '[') cls = true; else if (ch === ']') cls = false;
          else if (ch === '/' && !cls) { ok = true; break; }
        }
        if (ok) {
          out[i] = '/';
          for (let k = i + 1; k < j; k++) out[k] = '\x01';
          out[j] = '/'; i = j + 1;
          while (i < n && /[a-z]/i.test(code[i])) { out[i] = code[i]; i++; }
          lastSig = (lastSig + '/').slice(-16);
          continue;
        }
      }
    }
    keep(c); sig(c);
  }
  return out.join('');
}

/** Scripturi inline JS din HTML: [{body, start}] (start = indexul corpului în html). Exclude scripturile cu src, JSON/ld+json/template și `skip(tag)` dacă e dat. */
export function inlineJsScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const t = (attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1];
    if (t && !/^(?:text\/javascript|application\/javascript|module|text\/ecmascript|application\/ecmascript)$/i.test(t)) continue;
    out.push({body: m[2], start: m.index + m[0].indexOf('>') + 1});
  }
  return out;
}

export const lineAt = (text, index) => { let l = 1; for (let k = 0; k < index && k < text.length; k++) if (text.charCodeAt(k) === 10) l++; return l; };

/** Înlocuiește blocurile date (regex-uri) cu același număr de linii goale, ca numerele de linie să rămână cele din fișier. */
export function blankBlocks(html, regexes) {
  let s = html;
  for (const re of regexes) s = s.replace(re, (m) => '\n'.repeat((m.match(/\n/g) || []).length));
  return s;
}

/** Potrivește paranteza/acolada deschisă la `open` în `masked` (șiruri deja mascate). Întoarce indexul închiderii sau -1. */
export function matchClose(masked, open) {
  const pairs = {'{': '}', '[': ']', '(': ')'};
  const o = masked[open], c = pairs[o];
  if (!c) return -1;
  let depth = 0;
  for (let k = open; k < masked.length; k++) {
    const ch = masked[k];
    if (ch === o) depth++;
    else if (ch === c) { depth--; if (depth === 0) return k; }
  }
  return -1;
}
/** Deschiderea `{` care o include pe poziția `pos` (în masked) sau -1. */
export function enclosingOpen(masked, pos) {
  let depth = 0;
  for (let k = pos - 1; k >= 0; k--) {
    const ch = masked[k];
    if (ch === '}') depth++;
    else if (ch === '{') { if (depth === 0) return k; depth--; }
  }
  return -1;
}

/** Index de acolade `{}` pe cod mascat (O(n) o singură dată): enclosing(pos) → indexul `{` care include poziția (sau -1); close(open) → indexul `}` (sau -1). */
export function braceIndex(masked) {
  const n = masked.length, enc = new Int32Array(n), closeOf = new Map(), st = [];
  for (let i = 0; i < n; i++) {
    enc[i] = st.length ? st[st.length - 1] : -1;
    const c = masked.charCodeAt(i);
    if (c === 123) st.push(i);
    else if (c === 125 && st.length) { const o = st.pop(); closeOf.set(o, i); }
  }
  return {enclosing: (pos) => (pos >= 0 && pos < n ? enc[pos] : -1), close: (o) => (closeOf.has(o) ? closeOf.get(o) : -1)};
}
