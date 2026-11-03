// Ajutoare comune parserelor. Un parser exportă {version, kind:'data'|'watch', run(src, http, ctx)}.
//  data  → {records:[{k,...}], structure:'semnătură', problems:[{type,msg}], summary:{}, labels:{k:text}}
//  watch → {checks:[{k, ok, detail}], summary:{}}
// Erorile tehnice se aruncă ca Error cu .type ∈ network|http|robots|parse|validation.
import {createHash} from 'node:crypto';

export const err = (type, msg) => Object.assign(new Error(msg), {type});

/** GET cu robots.txt (dacă sursa o cere) și verificarea codului de stare. */
export async function fetchOk(http, src, url, init) {
  const mode = (src.robots && src.robots.mode) || 'verifică';
  if (mode !== 'nu-se-aplică') {
    const a = await http.allowed(url);
    if (!a.ok) throw err('robots', `${a.why} (${url})`);
  }
  const r = await http.get(url, init);
  if (r.status < 200 || r.status >= 300) throw err('http', `HTTP ${r.status} la ${url}`);
  return r;
}
export function parseJson(text, what) { try { return JSON.parse(text); } catch (e) { throw err('parse', `${what}: JSON invalid (${e.message.slice(0, 80)})`); } }
export const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const h8 = (s) => createHash('sha1').update(norm(s)).digest('hex').slice(0, 10);
export function path(o, p) { return p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o); }

const ENT = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”'};
export function decodeEntities(s) {
  return s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
}
export function htmlToLines(html) {
  const t = String(html).replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/?(p|div|li|h[1-6]|tr|td|th|section|article|ul|ol|table|nav|header|footer|main|aside|dt|dd|blockquote|pre|form|option|figure|figcaption)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, '');
  return decodeEntities(t).split(/\r?\n/).map((l) => l.replace(/[\s ]+/g, ' ').trim()).filter(Boolean);
}
