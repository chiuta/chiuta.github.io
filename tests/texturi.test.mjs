// Teste Node pentru tools/fff-texturi.js (texturi fractale): presete, determinism, plăci fără cusătură (CPU), strat translucid, înregistrare în plan.   Rulare: node tests/texturi.test.mjs
import {createRequire} from 'node:module'; import path from 'node:path'; import fs from 'node:fs'; import {fileURLToPath} from 'node:url';
const require = createRequire(import.meta.url), HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, bad = 0; const queue = []; const T = (n, f) => queue.push([n, f]);
const yes = (c, m) => { if (!c) throw new Error(m); };
const X = require(path.join(HUB, 'tools/fff-texturi.js'));
const TILE = X.materials().filter((m) => !X.resolve(m).frac);
const SIZE = 64, render = (m, o = {}) => X.makeTexture(m, {size: SIZE, seed: 3, cpu: true, raw: true, tile: true, mode: 'opaque', ...o});

T('API: versiune, 18 materiale, Julia și Mandelbrot sunt fractale, restul sunt plăci', () => {
  yes(/^\d+\.\d+\.\d+$/.test(X.version), 'versiune ' + X.version); yes(X.materials().length >= 18, 'materiale ' + X.materials().length);
  yes(X.resolve('julia').frac === 'julia' && X.resolve('mandel').frac === 'mandel', 'fractale'); yes(TILE.length >= 16, 'plăci ' + TILE.length);
  yes(X.resolve('marmura').name === 'marble' && X.resolve('inexistent').name === 'parchment', 'alias și rezervă');
});
T('determinism: același sâmbure → aceiași octeți; alt sâmbure → alt rezultat', async () => {
  const a = await render('parchment'), b = await render('parchment'), c = await render('parchment', {seed: 4});
  yes(Buffer.compare(Buffer.from(a.image.data), Buffer.from(b.image.data)) === 0, 'aceiași octeți'); yes(Buffer.compare(Buffer.from(a.image.data), Buffer.from(c.image.data)) !== 0, 'alt sâmbure');
});
for (const m of TILE) {
  T('placă fără cusătură (periodicitate exactă, octave complete): ' + m, () => {
    const H = X._makeH(X.resolve(m), {tile: true, seed: 3, maxOct: 12}); let mx = 0;
    for (let i = 0; i < 120; i++) { const u = (i * 0.6180339887) % 1, v = (i * 0.7548776662) % 1, a = H(u, v); mx = Math.max(mx, Math.abs(a - H(u + 1, v)), Math.abs(a - H(u, v + 1)), Math.abs(a - H(u + 1, v + 1))); }
    yes(mx < 1e-6, 'H(u+1,v) diferă de H(u,v) cu ' + mx);   // greșeala tipică: o frecvență sau o perioadă neîntreagă → cusătură vizibilă la marginea plăcii
  });
}
T('plăcile randate (CPU) au dimensiunea cerută și pixeli opaci (mod opaque)', async () => {
  for (const m of ['washi', 'marble', 'nebula']) { const r = await render(m); yes(r.image.width === SIZE && r.image.height === SIZE, m + ' dimensiune'); for (let i = 3; i < r.image.data.length; i += 4) yes(r.image.data[i] === 255, m + ' alfa'); }
});
T('strat translucid: A=0 → complet transparent; A>0 → alfa ≤ A·255; media rămâne mică', async () => {
  const P = X.resolve('washi'), r = await render('washi'), mk = (A) => { const c = {data: new Uint8ClampedArray(r.image.data), width: SIZE, height: SIZE}; X.overlayize(c, {A, hi: P.hi, lo: P.lo, chroma: P.chroma, k: 3, mode: 'overlay'}); return c.data; };
  const z = mk(0); for (let i = 3; i < z.length; i += 4) yes(z[i] === 0, 'A=0 trebuie să fie transparent');
  const d = mk(0.4); let mx = 0, s = 0; for (let i = 3; i < d.length; i += 4) { mx = Math.max(mx, d[i]); s += d[i]; }
  yes(mx <= 0.4 * 255 + 1, 'alfa maxim ' + mx); yes(s / (d.length / 4) < 0.25 * 255, 'alfa mediu prea mare ' + s / (d.length / 4)); yes(mx > 20, 'stratul nu se vede');
});
T('fără document: motorul nu pornește singur (Node) și configurarea acceptă doar chei cunoscute', () => {
  yes(X.info() === undefined || X.info() === null, 'info fără pornire'); const c = X.configure({m: 'marble', a: 1.5, necunoscut: 1}); yes(c.m === 'marble' && c.a === 1.5 && !('necunoscut' in c), 'configure');
  X.configure({m: 'parchment', a: 1});
});
T('hub: plan.json și texturi.json — fiecare aplicație cu fff-texturi are material valid și intensitate 0–3', () => {
  const ad = path.join(HUB, 'tools/envelope-adapters'), plan = JSON.parse(fs.readFileSync(path.join(ad, 'plan.json'), 'utf8')), cfg = JSON.parse(fs.readFileSync(path.join(ad, 'texturi.json'), 'utf8'));
  for (const [slug, p] of Object.entries(plan)) if ((p.libs || []).includes('fff-texturi')) {
    const c = cfg[slug]; yes(c, 'lipsește configurația pentru ' + slug); yes(TILE.includes(c.m), `${slug}: material ${c.m}`); yes(!c.p || TILE.includes(c.p), `${slug}: panou ${c.p}`);
    yes(c.a > 0 && c.a <= 3, `${slug}: intensitate ${c.a}`); if (c.hero) yes(c.hero.sel && ['julia', 'mandel', ...TILE].includes(c.hero.m), `${slug}: hero`);
  }
  for (const slug of Object.keys(cfg)) yes((plan[slug] && plan[slug].libs || []).includes('fff-texturi'), `${slug}: configurat, dar fără fff-texturi în plan`);
});
for (const [n, f] of queue) { try { await f(); ok++; console.log('ok   ' + n); } catch (e) { bad++; console.log('FAIL ' + n + '\n       ' + e.message); } }
console.log(`\n${ok} trecute, ${bad} eșuate`); process.exit(bad ? 1 : 0);
