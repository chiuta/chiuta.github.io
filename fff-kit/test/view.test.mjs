// Teste FFF.view (kit 1.4.0): antete de tabel fixe + bară de zoom + zoom automat. Rulare: node test/view.test.mjs
import {makeApp, launch, check, summary, sleep, axe} from './_pw.mjs';

const browser = await launch();
const NOWD = "Object.defineProperty(navigator, 'webdriver', {get: () => false});";
const rows = (n, c) => Array.from({length: n}, (_, i) => `<tr><td>${c}${i}</td><td>valoare ${i}</td><td>x</td></tr>`).join('');
function page(extra = '', head = '') {
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>t</title>${head}
<style>body{font:15px/1.5 sans-serif;margin:0;background:#fff;color:#111}main{max-width:640px;margin:0 auto;padding:12px}th{background:#eee}.w{overflow-x:auto}</style></head><body>
<main><h1>Titlu</h1><p>Un paragraf de text ca să existe conținut în pagină.</p>
<table id="t1"><thead><tr><th>A</th><th>B</th><th>C</th></tr></thead><tbody>${rows(80, 'a')}</tbody></table>
<div class="w" id="w2"><table id="t2"><thead><tr><th>A2</th><th>B2</th><th>C2</th></tr></thead><tbody>${rows(80, 'b')}</tbody></table></div>
<table id="t3"><thead><tr><th>G1</th><th>G2</th></tr><tr><th>s1</th><th>s2</th></tr></thead><tbody>${rows(60, 'c')}</tbody></table>
${extra}</main></body></html>`;
}
async function open(url, {w = 1440, h = 900, touch = false, init, query = ''} = {}) {
  const ctx = await browser.newContext({viewport: {width: w, height: h}, isMobile: touch, hasTouch: touch});
  await ctx.route(/^https?:/, (r) => r.abort());
  const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  if (init) await p.addInitScript(init);
  await p.goto(url + query); await p.waitForTimeout(500);
  return {ctx, p, errors};
}
const app = makeApp(page(), {modules: 'core,exit,view', info: false});

console.log('browser automatizat: pagina rămâne neschimbată, dar antetele sunt fixe');
{
  const {ctx, p} = await open(app.url);
  check('fără bară și fără zoom', await p.evaluate(() => !document.querySelector('[data-fff-view]') && !document.documentElement.style.zoom));
  check('API prezent', await p.evaluate(() => typeof FFF.view.mount === 'function' && typeof FFF.view.get === 'function'));
  check('antet de tabel: position sticky', await p.evaluate(() => getComputedStyle(document.querySelector('#t1 th')).position === 'sticky'));
  await p.evaluate(() => window.scrollTo(0, 700)); await sleep(150);
  check('antetul rămâne lipit sus la derulare', await p.evaluate(() => Math.abs(document.querySelector('#t1 th').getBoundingClientRect().top) <= 1.5), await p.evaluate(() => document.querySelector('#t1 th').getBoundingClientRect().top));
  check('antetul are fundal opac (nu se vede conținutul prin el)', await p.evaluate(() => !/rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(document.querySelector('#t1 th')).backgroundColor)));
  await ctx.close();
}

console.log('tabel într-un container cu derulare orizontală');
{
  const {ctx, p} = await open(app.url);
  await sleep(700);
  check('containerul primește înălțime maximă și derulează pe verticală', await p.evaluate(() => { const w = document.querySelector('#w2'); return w.getAttribute('data-fff-vh') === '1' && getComputedStyle(w).overflowY === 'auto' && w.scrollHeight > w.clientHeight; }));
  await p.evaluate(() => { const w = document.querySelector('#w2'); w.scrollTop = 300; });
  await sleep(150);
  check('antetul rămâne lipit sus în container', await p.evaluate(() => { const w = document.querySelector('#w2').getBoundingClientRect(), th = document.querySelector('#t2 th').getBoundingClientRect(); return Math.abs(th.top - w.top) <= 1.5; }));
  await ctx.close();
}

console.log('antet pe două rânduri');
{
  const {ctx, p} = await open(app.url);
  await sleep(500);
  await p.evaluate(() => window.scrollTo(0, document.querySelector('#t3').getBoundingClientRect().top + scrollY + 200)); await sleep(200);
  check('al doilea rând se așază sub primul', await p.evaluate(() => { const a = document.querySelector('#t3 thead tr:nth-child(1) th').getBoundingClientRect(), b = document.querySelector('#t3 thead tr:nth-child(2) th').getBoundingClientRect(); return Math.abs(a.top) <= 1.5 && Math.abs(b.top - a.bottom) <= 1.5; }));
  await ctx.close();
}

console.log('stilul aplicației are prioritate');
{
  const a = makeApp(page('', '<style>th{position:static}</style>'), {modules: 'core,view', info: false});
  const {ctx, p} = await open(a.url);
  check('th{position:static} din aplicație nu e suprascris', await p.evaluate(() => getComputedStyle(document.querySelector('#t1 th')).position === 'static'));
  await ctx.close();
}

console.log('dezactivare');
{
  const a = makeApp(page('', '<meta name="fff-view" content="off">'), {modules: 'core,view', info: false});
  const {ctx, p} = await open(a.url, {init: NOWD});
  check('fff-view=off: fără bară, fără zoom, fără antete lipicioase', await p.evaluate(() => !document.querySelector('[data-fff-view]') && !document.documentElement.style.zoom && getComputedStyle(document.querySelector('#t1 th')).position !== 'sticky'));
  await ctx.close();
  const b = makeApp(page('', '<meta name="fff-view" content="noauto">'), {modules: 'core,view', info: false});
  const r = await open(b.url, {init: NOWD});
  check('fff-view=noauto: bara există, zoom automat 1', await r.p.evaluate(() => !!document.querySelector('[data-fff-view]') && FFF.view.get().auto === 1));
  await r.ctx.close();
  const c = makeApp(page('', '<meta name="fff-view" content="sticky">'), {modules: 'core,view', info: false});
  const s = await open(c.url, {init: NOWD});
  check('fff-view=sticky: fără bară, antete fixe', await s.p.evaluate(() => !document.querySelector('[data-fff-view]') && getComputedStyle(document.querySelector('#t1 th')).position === 'sticky'));
  await s.ctx.close();
  const d = await open(app.url, {init: NOWD, query: '?kiosk=1'});
  check('?kiosk=1: fără bară', await d.p.evaluate(() => !document.querySelector('[data-fff-view]')));
  await d.ctx.close();
  const e = await open(app.url, {init: NOWD, query: '?noview=1'});
  check('?noview=1: fără bară și fără antete lipicioase', await e.p.evaluate(() => !document.querySelector('[data-fff-view]') && getComputedStyle(document.querySelector('#t1 th')).position !== 'sticky'));
  await e.ctx.close();
}

console.log('zoom automat');
{
  const {ctx, p, errors} = await open(app.url, {init: NOWD});
  await sleep(1300);
  const g = await p.evaluate(() => ({g: FFF.view.get(), z: document.documentElement.style.zoom, bar: !!document.querySelector('[data-fff-view]'), ov: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2}));
  check('desktop lat, conținut îngust: zoom automat > 1.5', g.bar && g.g.auto > 1.5 && g.g.auto <= 2.2, JSON.stringify(g));
  check('fără derulare orizontală după zoom', !g.ov);
  check('zoom aplicat pe <html>', Math.abs(parseFloat(g.z) - g.g.total) < 0.011);
  check('fără erori de pagină', errors.length === 0, errors.join(' | '));
  await ctx.close();
}
{
  const {ctx, p} = await open(app.url, {init: NOWD, w: 390, h: 844, touch: true});
  await sleep(1300);
  const g = await p.evaluate(() => FFF.view.get());
  check('telefon: zoom automat moderat (1.0–1.35), text de bază ~18px', g.auto >= 1 && g.auto <= 1.35, JSON.stringify(g));
  await ctx.close();
}
{
  const wide = makeApp(page('<div style="width:1800px;height:20px;background:#ccc"></div>'), {modules: 'core,view', info: false});
  const {ctx, p} = await open(wide.url, {init: NOWD});
  await sleep(1300);
  check('pagină cu derulare orizontală deja: zoom automat 1', await p.evaluate(() => FFF.view.get().auto === 1));
  await ctx.close();
  const cv = makeApp(page('<canvas style="display:block;width:100%;height:700px"></canvas>'), {modules: 'core,view', info: false});
  const r = await open(cv.url, {init: NOWD});
  await sleep(1300);
  check('aplicație dominată de <canvas>: zoom automat 1', await r.p.evaluate(() => FFF.view.get().auto === 1));
  await r.ctx.close();
}
{
  // autoverificare: un element cu lățime fixă care încape la zoom 1, dar nu și mărit
  const tight = makeApp(page('').replace('<main>', '<div style="width:1400px;margin:0 auto;height:10px"></div><main>'), {modules: 'core,view', info: false});
  const {ctx, p} = await open(tight.url, {init: NOWD, w: 1440});
  await sleep(1300);
  const g = await p.evaluate(() => ({a: FFF.view.get().auto, ov: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2}));
  check('autoverificare: nu rămâne derulare orizontală nouă', !g.ov, JSON.stringify(g));
  await ctx.close();
}

console.log('bara de zoom și acțiunile utilizatorului');
{
  const {ctx, p} = await open(app.url, {init: NOWD});
  await sleep(1300);
  const q = await p.evaluate(() => { const r = document.querySelector('[data-fff-view]'), b = r.querySelectorAll('button'); return {n: b.length, lab: [...b].map((x) => x.getAttribute('aria-label')), role: r.getAttribute('role'), rect: r.getBoundingClientRect().toJSON(), vh: innerHeight, vw: innerWidth}; });
  check('trei butoane cu etichete', q.n === 3 && q.lab.every((x) => x && x.length > 2) && q.role === 'toolbar', JSON.stringify(q.lab));
  check('bara e pe marginea laterală, în ecran, pe verticală', q.rect.bottom <= q.vh + 1 && q.rect.top >= 0 && q.rect.height > q.rect.width * 2 && (q.rect.right >= q.vw - 20 || q.rect.left <= 20) && q.rect.right <= q.vw + 1 && q.rect.left >= -1, JSON.stringify(q.rect));
  const t0 = await p.evaluate(() => FFF.view.get().total);
  await p.click('[data-fff-view] button:nth-child(2)'); await sleep(150);
  const g1 = await p.evaluate(() => FFF.view.get());
  check('„+” mărește (×1,12)', Math.abs(g1.total / t0 - 1.12) < 0.02 && g1.user > 1.1, JSON.stringify(g1));
  await p.click('[data-fff-view] button:nth-child(1)'); await p.click('[data-fff-view] button:nth-child(1)'); await sleep(150);
  const g2 = await p.evaluate(() => FFF.view.get());
  check('„−” micșorează', g2.user < 1, JSON.stringify(g2));
  const w = await p.evaluate(() => document.querySelector('[data-fff-view]').getBoundingClientRect().height);
  check('bara își păstrează mărimea (contra-zoom)', Math.abs(w - 144) <= 3, String(w));
  const sv = await p.evaluate(() => Object.keys(localStorage).filter((k) => /\.view$/.test(k)));
  check('alegerea se păstrează în stocare sub fff.<slug>.view', sv.length === 1 && /^fff\./.test(sv[0]), sv.join());
  await p.reload(); await sleep(1300);
  const g3 = await p.evaluate(() => FFF.view.get());
  check('după reîncărcare, alegerea revine', Math.abs(g3.user - g2.user) < 0.02, JSON.stringify(g3));
  await p.click('[data-fff-view] button:nth-child(3)'); await sleep(150);
  const g4 = await p.evaluate(() => ({g: FFF.view.get(), k: Object.keys(localStorage).filter((k) => /\.view$/.test(k)).length}));
  check('„automat” readuce la zoom-ul automat și șterge cheia', Math.abs(g4.g.user - 1) < 0.005 && g4.k === 0, JSON.stringify(g4));
  for (let i = 0; i < 40; i++) await p.evaluate(() => FFF.view.zoomIn());
  check('limita superioară 3×', await p.evaluate(() => FFF.view.get().total <= 3.0001 && document.querySelector('[data-fff-view] button:nth-child(2)').disabled));
  for (let i = 0; i < 60; i++) await p.evaluate(() => FFF.view.zoomOut());
  check('limita inferioară 0,5×', await p.evaluate(() => FFF.view.get().total >= 0.4999 && document.querySelector('[data-fff-view] button:nth-child(1)').disabled));
  await p.evaluate(() => FFF.view.reset());
  const ax = await axe(p, '[data-fff-view]');
  check('axe: bara de zoom fără încălcări', (ax.violations || []).length === 0, JSON.stringify((ax.violations || []).map((v) => v.id)));
  await ctx.close();
}

console.log('coexistă cu butonul ✕ (exit)');
{
  const {ctx, p} = await open(app.url, {init: NOWD, w: 390, h: 844, touch: true});
  await sleep(1400);
  const r = await p.evaluate(() => { const e = document.querySelector('[data-fff-exit]'), v = document.querySelector('[data-fff-view]'); const a = e.getBoundingClientRect(), b = v.getBoundingClientRect(); return {both: !!e && !!v, overlap: !(a.right < b.left || b.right < a.left || a.bottom < b.top || b.bottom < a.top), ew: a.width, z: FFF.view.get().total}; });
  check('ambele există și nu se suprapun', r.both && !r.overlap, JSON.stringify(r));
  check('✕ își păstrează mărimea (contra-zoom)', Math.abs(r.ew - 44) <= 3, String(r.ew));
  await ctx.close();
}

console.log('traduceri');
{
  const {ctx, p} = await open(app.url, {init: NOWD});
  await sleep(1200);
  const langs = ['ro', 'en', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
  const seen = new Set();
  for (const l of langs) { await p.evaluate((x) => FFF.setLang ? FFF.setLang(x) : (document.documentElement.lang = x), l); await sleep(60); seen.add(await p.evaluate(() => document.querySelector('[data-fff-view] button').getAttribute('aria-label'))); }
  check('etichetele urmăresc limba (cel puțin 6 variante distincte)', seen.size >= 6, [...seen].join('|'));
  await ctx.close();
}
await browser.close();
summary('view');
