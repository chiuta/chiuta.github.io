// Parser „webnode-titles” (ACORDAJ ← cursurispirituale.webnode.ro): listă numerotată de titluri, posibil pe mai multe pagini ale aceluiași site.
// Defensiv: nu presupune o structură HTML anume, ci linii de forma „123. Titlu”. Dacă structura se schimbă (nicio linie numerotată, numerotare
// dezordonată, conținut diferit de al aplicației) rezultatul este respins, nu aplicat. Instantaneul păstrează doar hash-uri ale titlurilor,
// nu și titlurile (drepturile asupra listei nu sunt verificate; vezi data/sources.json → ACORDAJ).
import {fetchOk, htmlToLines, h8, err} from './common.mjs';

const LINE = /^(\d{1,4})\s*[.)–—:-]\s*(\S.{1,240})$/;
export function extractNumbered(lines) {
  const out = [];
  for (const l of lines) {
    const m = l.match(LINE); if (!m) continue;
    const n = +m[1], title = m[2].trim();
    if (!n || !/\p{L}{2,}/u.test(title)) continue;
    if (n >= 1900 && n <= 2100) continue;          // ani, nu numere de ordine
    out.push({n, title});
  }
  return out;
}
export function internalLinks(html, base, include, limit) {
  const u0 = new URL(base), seen = new Set([u0.origin + u0.pathname]), out = [];
  for (const m of String(html).matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"'#]+)["']/gi)) {
    let u; try { u = new URL(m[1].replace(/&amp;/g, '&'), base); } catch { continue; }
    if (u.origin !== u0.origin || u.search || /\.(pdf|jpe?g|png|gif|webp|svg|zip|mp3|mp4|css|js|ico|xml)$/i.test(u.pathname)) continue;
    if (include && !new RegExp(include).test(u.pathname)) continue;
    const key = u.origin + u.pathname.replace(/\/+$/, '/');
    if (seen.has(key)) continue; seen.add(key); out.push(key);
    if (out.length >= limit) break;
  }
  return out;
}

export default {
  version: 1, kind: 'data',
  async run(src, http, ctx) {
    const start = src.url, cr = src.crawl || {};
    const pages = [], first = await fetchOk(http, src, start); pages.push({url: start, html: http.text(first)});
    for (const u of internalLinks(pages[0].html, start, cr.include, cr.maxPages ?? 30)) {
      try { const r = await fetchOk(http, src, u); pages.push({url: u, html: http.text(r)}); }
      catch (e) { if (e.type === 'robots') continue; throw e; }   // pagină interzisă de robots: o sărim; alte erori opresc rularea
    }
    const byN = new Map(), problems = [], labels = {};
    let order = [];
    for (const p of pages) for (const e of extractNumbered(htmlToLines(p.html))) {
      const k = String(e.n).padStart(4, '0'), h = h8(e.title);
      if (byN.has(k) && byN.get(k).h !== h) { problems.push({type: 'structure', msg: `numărul ${e.n} apare cu două titluri diferite (${p.url})`}); continue; }
      if (!byN.has(k)) { byN.set(k, {k, h}); labels[k] = e.title; order.push(e.n); }
    }
    const records = [...byN.values()].sort((a, b) => (a.k < b.k ? -1 : 1));
    const nums = records.map((r) => +r.k), inc = nums.filter((n, i) => i === 0 || n > nums[i - 1]).length;
    const dense = nums.length ? nums.length / nums[nums.length - 1] : 0;
    let structure = 'none';
    if (records.length) structure = 'numbered-lines' + (dense >= 0.9 ? '' : '/sparse');
    if (records.length && dense < 0.5) problems.push({type: 'structure', msg: `numerotare rară (${records.length} intrări până la ${nums[nums.length - 1]}): probabil nu e lista de titluri`});
    const summary = {pages: pages.length, maxNumber: nums[nums.length - 1] || 0};
    const bl = ctx.baseline;
    if (bl && bl.hashes && records.length) {
      const set = new Set(bl.hashes), hit = records.filter((r) => set.has(r.h)).length;
      summary.baselineOverlapPct = +(100 * hit / Math.max(records.length, bl.hashes.length)).toFixed(1);
      const need = src.validator.minBaselineOverlapPct ?? 70;
      if (summary.baselineOverlapPct < need) problems.push({type: 'validation', msg: `doar ${summary.baselineOverlapPct}% din titluri coincid cu cele din aplicație (minim ${need}%): conținut sau structură diferite`});
    }
    return {records, structure, problems, summary, labels};
  },
};
