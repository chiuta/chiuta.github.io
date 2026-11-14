#!/usr/bin/env node
// Înregistrează (idempotent, cu blocare de fișier) o aplicație pentru texturile fractale: adaugă „fff-texturi” la modulele ei din plan.json
// și scrie în texturi.json materialul și intensitatea. Apoi se rulează `node tools/inject-shared.mjs <dirAplicație> <slug>`.
//   node tools/texturi-register.mjs <slug> [--m material] [--p material-panouri] [--a 1] [--seed 7] [--hero julia|mandel|none] [--hero-a 0.9]
//                                   [--sel "selector,...pt hero"] [--inc "selector"] [--exc "selector"] [--max 220] [--show]
// Materiale pentru pagină și panouri (se repetă fără cusătură): parchment washi linen leather wood marble granite slate brass gold steel jade ice nebula moss sand.
// Julia / Mandelbrot sunt doar pentru „hero” (imagine mare, nerepetată). Fără opțiuni, păstrează ce există deja pentru slug (sau „parchment”).
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
const HUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), AD = path.join(HUB, 'tools/envelope-adapters');
const argv = process.argv.slice(2), slug = argv[0];
const val = (f, d) => { const i = argv.indexOf(f); return i < 0 ? d : argv[i + 1]; };
if (!slug || slug.startsWith('--')) { console.error('utilizare: texturi-register.mjs <slug> [--m material] [--p material] [--a 1] [--seed 7] [--hero julia|mandel|none] [--sel "..."] [--inc "..."] [--exc "..."]'); process.exit(2); }
if (!/^[a-z0-9][a-z0-9._-]*$/.test(slug)) { console.error('slug invalid: ' + slug); process.exit(2); }
const TILE = ['parchment', 'washi', 'linen', 'leather', 'wood', 'marble', 'granite', 'slate', 'brass', 'gold', 'steel', 'jade', 'ice', 'nebula', 'moss', 'sand'];
const ALIAS = {hartie: 'washi', pergament: 'parchment', lemn: 'wood', marmura: 'marble', piatra: 'granite', piele: 'leather', bronz: 'brass', aur: 'gold', otel: 'steel', gheata: 'ice', nebuloasa: 'nebula', muschi: 'moss', nisip: 'sand'};
const mat = (s, f) => { s = ALIAS[s] || s; if (!TILE.includes(s)) { console.error(`material necunoscut pentru ${f}: ${s} (alege din: ${TILE.join(' ')})`); process.exit(2); } return s; };

// formatul compact, un slug pe linie (ca în fișierele existente → diferențe mici în git)
const fmt = (v) => Array.isArray(v) ? '[' + v.map(fmt).join(', ') + ']' : (v && typeof v === 'object') ? '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + fmt(x)).join(', ') + '}' : JSON.stringify(v);
const dump = (o) => '{\n' + Object.entries(o).map(([k, v]) => '  ' + JSON.stringify(k) + ': ' + fmt(v)).join(',\n') + '\n}\n';
const readJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };

// blocare simplă prin fișier (mai mulți agenți rulează în paralel pe același hub)
const LOCK = path.join(AD, '.texturi.lock'); let fd = -1;
for (let i = 0; i < 600; i++) {
  try { fd = fs.openSync(LOCK, 'wx'); break; } catch (e) {
    if (e.code !== 'EEXIST') throw e;
    try { if (Date.now() - fs.statSync(LOCK).mtimeMs > 30000) fs.unlinkSync(LOCK); } catch { /* alt proces a eliberat-o */ }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
}
if (fd < 0) { console.error('nu am putut obține blocarea ' + LOCK); process.exit(1); }
try {
  const planF = path.join(AD, 'plan.json'), cfgF = path.join(AD, 'texturi.json');
  const plan = readJ(planF, {}), cfg = readJ(cfgF, {});
  const p = plan[slug] || {libsOnly: true, libs: []};
  p.libs = [...new Set([...(p.libs || []), 'fff-texturi'])]; plan[slug] = p;
  const c = cfg[slug] || {m: 'parchment', a: 1, seed: 7};
  if (val('--m')) c.m = mat(val('--m'), '--m');
  if (val('--p')) c.p = val('--p') === 'none' ? undefined : mat(val('--p'), '--p');
  if (val('--a')) c.a = +val('--a');
  if (val('--seed')) c.seed = +val('--seed') | 0;
  if (val('--inc') != null) c.inc = val('--inc');
  if (val('--exc') != null) c.exc = val('--exc');
  if (val('--max')) c.max = +val('--max') | 0;
  const h = val('--hero');
  if (h === 'none') delete c.hero;
  else if (h) { if (!['julia', 'mandel'].includes(h) && !TILE.includes(h)) { console.error('--hero: julia | mandel | none'); process.exit(2); } c.hero = {m: h, A: +val('--hero-a', 0.9), sel: val('--sel', '')}; if (!c.hero.sel) { console.error('--hero cere --sel "selector,…" (elementele cu fundal-erou)'); process.exit(2); } }
  for (const k of Object.keys(c)) if (c[k] === undefined || c[k] === '') delete c[k];
  if (!(c.a > 0 && c.a <= 3)) { console.error('--a trebuie să fie între 0 și 3'); process.exit(2); }
  cfg[slug] = c;
  const tmp = (f, s) => { fs.writeFileSync(f + '.tmp', s); fs.renameSync(f + '.tmp', f); };
  tmp(planF, dump(plan)); tmp(cfgF, dump(cfg));
  console.log(slug + ' → plan: ' + fmt(plan[slug]) + ' | texturi: ' + fmt(cfg[slug]));
} finally { fs.closeSync(fd); try { fs.unlinkSync(LOCK); } catch { /* deja eliberat */ } }
