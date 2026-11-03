// TEMPORAR: tipărește structura (nu conținutul) paginilor ACORDAJ; literele devin „a”, cifrele rămân.
import {htmlToLines} from './parsers/common.mjs';
import {internalLinks} from './parsers/html.mjs';
const UA = 'chiuta-refresh/1.0 (+https://github.com/chiuta/chiuta.github.io; structura sursei)';
const mask = (s) => String(s).replace(/\p{L}/gu, 'a').replace(/a{3,}/g, (m) => 'a'.repeat(Math.min(m.length, 12)));
const get = async (u) => { const r = await fetch(u, {headers: {'user-agent': UA}}); return {status: r.status, ct: r.headers.get('content-type'), text: await r.text()}; };
const rb = await get('https://cursurispirituale.webnode.ro/robots.txt'); console.log('robots', rb.status, '\n' + rb.text.slice(0, 600));
const start = 'https://cursurispirituale.webnode.ro/';
const p0 = await get(start); console.log('start', p0.status, p0.text.length);
const links = internalLinks(p0.text, start, null, 60); console.log('links', links.length); console.log(links.join('\n'));
for (const u of [start, ...links.slice(0, 12)]) {
  const p = u === start ? p0 : await get(u); await new Promise((r) => setTimeout(r, 1500));
  const lines = htmlToLines(p.text);
  const num = lines.filter((l) => /^\d{1,4}\s*[.)–—:-]/.test(l));
  console.log('\n== ' + u, p.status, 'bytes', p.text.length, 'lines', lines.length, 'numbered', num.length);
  console.log(num.slice(0, 6).map(mask).join('\n'));
  const idx = p.text.search(/>\s*1\s*[.)]\s*</); 
  const cand = p.text.search(/\b1\s*\.\s/);
  const at = idx >= 0 ? idx : cand;
  if (at >= 0) console.log('html@', mask(p.text.slice(Math.max(0, at - 200), at + 300).replace(/\s+/g, ' ')));
  // numere de forma N. în text brut
  const raw = [...p.text.matchAll(/(?:^|[>\s])(\d{1,4})\s*\.\s+\p{L}/gu)].length; console.log('raw N. matches', raw);
}
