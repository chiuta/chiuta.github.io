// Utilitare comune pentru CSP și scripturi inline (fff-kit). Fără dependențe.
import {createHash} from 'node:crypto';

const EXEC_TYPES = new Set(['', 'text/javascript', 'application/javascript', 'module']);

/** Returnează [{start,end,body,attrs}] pentru scripturile inline executabile (fără src). */
export function inlineScripts(html) {
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const t = (attrs.match(/\btype\s*=\s*["']?([^"'\s>]*)/i) || [0, ''])[1].toLowerCase();
    if (!EXEC_TYPES.has(t)) continue;
    if (!m[2].trim()) continue;
    out.push({start: m.index, end: m.index + m[0].length, body: m[2], attrs});
  }
  return out;
}

export function sha256b64(s) {
  return createHash('sha256').update(s, 'utf8').digest('base64');
}

export function cspMeta(html) {
  const m = html.match(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/i);
  return m ? {tag: m[0], index: m.index} : null;
}

/** Rescrie lista de hash-uri din script-src. Dacă script-src conține 'unsafe-inline' nu face nimic. */
export function recomputeCspHashes(html) {
  const meta = cspMeta(html);
  if (!meta) return {html, changed: false, note: 'fără CSP'};
  const cm = meta.tag.match(/content=("([^"]*)"|'([^']*)')/i);
  const q = cm[1][0];
  const content = cm[2] ?? cm[3];
  const sm = content.match(/(^|;\s*)(script-src)([^;]*)/);
  if (!sm) return {html, changed: false, note: 'fără script-src'};
  if (/'unsafe-inline'/.test(sm[3])) return {html, changed: false, note: 'unsafe-inline'};
  const hashes = [...new Set(inlineScripts(html).map(s => `'sha256-${sha256b64(s.body)}'`))];
  const have = new Set((sm[3].match(/'sha256-[^']+'/g) || []));
  if (have.size === hashes.length && hashes.every(h => have.has(h))) return {html, changed: false, note: 'neschimbat'};
  const kept = sm[3].replace(/\s*'sha256-[^']+'/g, '').trim();
  const newDir = `script-src${kept ? ' ' + kept : ''}${hashes.length ? ' ' + hashes.join(' ') : ''}`;
  const newContent = content.replace(/(^|;\s*)script-src[^;]*/, (_, p) => p + newDir);
  const newTag = meta.tag.replace(cm[0], `content=${q}${newContent}${q}`);
  return {html: html.replace(meta.tag, () => newTag), changed: newContent !== content, note: 'ok'};
}

/** Verifică dacă toate scripturile inline sunt acoperite de CSP. Returnează lista scripturilor neacoperite. */
export function checkCspHashes(html) {
  const meta = cspMeta(html);
  if (!meta) return {ok: true, missing: [], note: 'fără CSP'};
  if (/script-src[^;"]*'unsafe-inline'/.test(meta.tag)) return {ok: true, missing: [], note: 'unsafe-inline'};
  if (!/script-src|default-src/.test(meta.tag)) return {ok: true, missing: [], note: 'script-src nerestricționat'};
  const miss = [];
  for (const s of inlineScripts(html)) {
    const h = `'sha256-${sha256b64(s.body)}'`;
    if (!meta.tag.includes(h)) miss.push(h);
  }
  return {ok: miss.length === 0, missing: miss, note: 'ok'};
}

/** Directivă CSP: adaugă/înlocuiește surse pentru o directivă (ex. manifest-src 'self'). */
export function setCspDirective(html, name, sources) {
  const meta = cspMeta(html);
  if (!meta) return html;
  const cm = meta.tag.match(/content=("([^"]*)"|'([^']*)')/i);
  const q = cm[1][0], content = cm[2] ?? cm[3];
  const re = new RegExp(`(^|;\\s*)${name}\\b[^;]*`);
  const newContent = re.test(content)
    ? content.replace(re, (_, p) => `${p}${name} ${sources}`)
    : `${content.replace(/;\s*$/, '')}; ${name} ${sources}`;
  return html.replace(meta.tag, () => meta.tag.replace(cm[0], `content=${q}${newContent}${q}`));
}
