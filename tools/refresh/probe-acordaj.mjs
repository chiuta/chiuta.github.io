// TEMPORAR: tipărește structura (nu conținutul) paginilor ACORDAJ; literele devin „a”, cifrele rămân.
import {htmlToLines} from './parsers/common.mjs';
const UA = 'chiuta-refresh/1.0 (+https://github.com/chiuta/chiuta.github.io; structura sursei)';
const mask = (s) => String(s).replace(/\p{L}/gu, 'a').replace(/a{3,}/g, (m) => 'a'.repeat(Math.min(m.length, 8)));
const get = async (u) => { const r = await fetch(u, {headers: {'user-agent': UA}}); return {status: r.status, text: await r.text()}; };
const sm = await get('https://cursurispirituale.webnode.ro/sitemap.xml'); const urls = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
console.log('sitemap', sm.status, urls.length); console.log(urls.slice(0, 40).join('\n'));
const p = await get('https://cursurispirituale.webnode.ro/'); const lines = htmlToLines(p.text);
const hist = {}; for (const l of lines) { const k = l.length < 15 ? 's' : l.length < 40 ? 'm' : l.length < 90 ? 'l' : 'xl'; hist[k] = (hist[k] || 0) + 1; } console.log('hist', JSON.stringify(hist));
const withDigit = lines.filter((l) => /^\d/.test(l)); console.log('start-with-digit', withDigit.length, withDigit.slice(0, 10).map(mask));
const mid = Math.floor(lines.length / 2); console.log('--- mid lines'); console.log(lines.slice(mid, mid + 40).map((l) => mask(l).slice(0, 80)).join('\n'));
console.log('--- first 40 lines'); console.log(lines.slice(0, 40).map((l) => mask(l).slice(0, 80)).join('\n'));
const i = p.text.indexOf('342.'); console.log('html@342', mask(p.text.slice(Math.max(0, i - 600), i + 400).replace(/\s+/g, ' ')));
// structura HTML: numără etichetele frecvente
const tags = {}; for (const m of p.text.matchAll(/<(\w+)[\s>]/g)) tags[m[1]] = (tags[m[1]] || 0) + 1; console.log('tags', JSON.stringify(Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 14)));
