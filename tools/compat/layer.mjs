// tools/compat/layer.mjs — fără dependențe (nu cere acorn): extragerea scripturilor inline ale unei pagini și injectarea stratului fff-compat
// (<script id="fff-compat"> + modulul fff-imp) în paginile fără kit care folosesc FFF.rx/FFF.imp sau API-uri acoperite doar de el.
// Folosit de lower-lib.mjs (codemodul) și de tools/transparenta.mjs (pagina generată își include singură stratul, ca `--check` să rămână stabil în CI).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const BLOCK_RE = /\n<!--fff:kit:start[^>]*-->[\s\S]*?<!--fff:kit:end-->/;
const COMPAT_RE = /\n<!--fff:compat:start-->[\s\S]*?<!--fff:compat:end-->/;
const INFO_RE = /\n<!--fff:info:start-->[\s\S]*?<!--fff:info:end-->/;
const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

/** Scripturile inline JS ale aplicației (fără blocul kit/fff-info și fără JSON/șabloane). */
export function appScripts(html) {
  const out = [];
  const mask = (re) => { const m = html.match(re); return m ? [m.index, m.index + m[0].length] : null; };
  const skip = [mask(BLOCK_RE), mask(INFO_RE), mask(COMPAT_RE)].filter(Boolean);
  SCRIPT_RE.lastIndex = 0;
  let m;
  while ((m = SCRIPT_RE.exec(html))) {
    if (skip.some(([a, b]) => m.index >= a && m.index < b)) continue;
    const attrs = m[1];
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const t = ((attrs.match(/\btype\s*=\s*["']?([^"'\s>]*)/i) || [0, ''])[1] || '').toLowerCase();
    if (!['', 'text/javascript', 'application/javascript', 'module'].includes(t)) continue;
    if (!m[2].trim()) continue;
    const start = m.index + m[0].indexOf('>') + 1;
    out.push({start, end: start + m[2].length, code: m[2], module: t === 'module', attrs});
  }
  return out;
}

const KIT_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'fff-kit', 'src', 'compat.js');
function insertionIndex(html) {   // aceeași regulă ca în fff-kit/build.mjs: imediat după <meta charset>
  let m = html.match(/<meta\b[^>]*\bcharset\s*=[^>]*>/i);
  if (m && m.index < (html.search(/<\/head>/i) >>> 0 || Infinity)) return m.index + m[0].length;
  m = html.match(/<head\b[^>]*>/i); if (m) return m.index + m[0].length;
  m = html.match(/<html\b[^>]*>/i); if (m) return m.index + m[0].length;
  m = html.match(/<!doctype[^>]*>/i); if (m) return m.index + m[0].length;
  return 0;
}
/** Paginile fără kit care ajung să folosească FFF.rx / FFF.imp (după coborâre) primesc doar stratul de compatibilitate al kitului
 *  (<script id="fff-compat"> + modulul fff-imp), între marcajele <!--fff:compat:start/end-->; paginile cu kit îl au deja. */
export function ensureCompat(html, opts = {}) {
  const fff = opts.fff || 'FFF';
  const uses = !!opts.force || appScripts(html).some((s) => new RegExp('(\\b' + fff + '\\.(rx|imp)|\\$+fff(Rx|Imp))\\(').test(s.code));
  const hasKit = /<script id="fff-compat">/.test(html) && /<script type="module" id="fff-imp">/.test(html) && !COMPAT_RE.test(html);
  if (!uses || hasKit) return {html, injected: false};
  const src = fs.readFileSync(opts.compatSrc || KIT_SRC, 'utf8').replace(/\s+$/, '');
  if (/<\/script|<!--/i.test(src)) throw new Error('compat.js conține „</script” sau „<!--”');
  const ver = (src.match(/C\.version = '([\d.]+)'/) || [0, '?'])[1];
  const block = '\n<!--fff:compat:start-->\n<script id="fff-compat">/* fff-compat ' + ver + ' — ES5, rulează înaintea restului */\n' + src + '\n</script>\n' +
    '<script type="module" id="fff-imp">window.__fffImp=function(u){return import(u)};</script>\n<!--fff:compat:end-->';
  let out;
  if (COMPAT_RE.test(html)) out = html.replace(COMPAT_RE, () => block);
  else { const i = insertionIndex(html); out = html.slice(0, i) + block + html.slice(i); }
  return {html: out, injected: out !== html, version: ver};
}
