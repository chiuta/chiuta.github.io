// TEMPORAR: structura duplicatelor (litere mascate).
import {htmlToLines} from './parsers/common.mjs';
import {extractNumbered} from './parsers/html.mjs';
const mask = (s) => String(s).replace(/\p{L}/gu, 'a').replace(/a{3,}/g, (m) => 'a'.repeat(Math.min(m.length, 8)));
const r = await fetch('https://cursurispirituale.webnode.ro/', {headers: {'user-agent': 'chiuta-refresh/1.0 (+https://github.com/chiuta/chiuta.github.io)'}});
const lines = htmlToLines(await r.text());
const ex = extractNumbered(lines);
const by = new Map(); ex.forEach((e, i) => { (by.get(e.n) || by.set(e.n, []).get(e.n)).push({i, t: mask(e.title).slice(0, 40)}); });
const dups = [...by].filter(([, v]) => v.length > 1);
console.log('entries', ex.length, 'distinct', by.size, 'dups', dups.length);
for (const [n, v] of dups.slice(0, 25)) console.log(n, JSON.stringify(v));
const li = lines.map((l, i) => [l, i]).filter(([l]) => /^1\b/.test(l)); console.log('lines starting 1:', li.length, li.slice(0, 6).map(([l, i]) => i + ':' + mask(l).slice(0, 50)).join(' | '));
const idx = lines.findIndex((l) => /^1 \S/.test(l)); console.log('first "1 " at', idx);
for (const [n, v] of dups.slice(0, 3)) for (const o of v) console.log('ctx', n, o.i, lines.slice(Math.max(0, lines.findIndex((l) => mask(l).slice(0, 40).includes(o.t)) - 1), +2).map((l) => mask(l).slice(0, 50)));
