// Teste FFF.a11y: panoul „Aa”, săgeata „Înapoi sus”, potrivirea la ecran, bara de zoom pe dreapta (kit ≥ 1.7). Rulare: node test/a11y.test.mjs
import {makeApp, launch, check, summary, sleep, axe} from './_pw.mjs';

const browser = await launch();
const NOWD = "Object.defineProperty(navigator, 'webdriver', {get: () => false});";
const para = Array.from({length: 60}, (_, i) => `<p>Paragraful ${i}: un text oarecare, destul de lung ca pagina să se deruleze.</p>`).join('');
const page = (head = '', body = '') => `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>t</title>${head}
<style>body{font:15px/1.5 sans-serif;margin:0;background:#fff;color:#111}main{max-width:640px;margin:0 auto;padding:12px}a{color:#05c}.sq{display:inline-block;width:30px;height:30px;background:#c33}</style></head>
<body><main><h1>Titlu</h1><p>Text <a href="#x">un link</a>.</p><span class="sq" id="sq"></span>${para}${body}</main></body></html>`;
async function open(url, {w = 1280, h = 800, touch = false, init, q = '?fffa11y=1'} = {}) {
  const ctx = await browser.newContext({viewport: {width: w, height: h}, isMobile: touch, hasTouch: touch});
  await ctx.route(/^https?:/, (r) => r.abort());
  const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load|ERR_|aborted/i.test(m.text())) errors.push(m.text()); });
  if (init) await p.addInitScript(init);
  await p.goto(url + q); await p.waitForTimeout(500);
  return {ctx, p, errors};
}
const app = makeApp(page(), {modules: 'core,store,view,a11y', info: false});
const box = (p, s) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return {l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height}; }, s);
const inScreen = (b, w, h) => b && b.l >= -0.5 && b.t >= -0.5 && b.r <= w + 0.5 && b.b <= h + 0.5;

console.log('montare condiționată');
{
  const {ctx, p} = await open(app.url, {q: ''});
  check('browser automatizat: nu se montează singur', await p.evaluate(() => !document.querySelector('[data-fff-a11y-ui]')));
  await ctx.close();
}
{
  const {ctx, p, errors} = await open(app.url);
  check('cu ?fffa11y=1: butonul „Aa” există, ≥44 px, cu nume accesibil', await p.evaluate(() => { const b = document.querySelector('.fff-a11y-aa'), r = b.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && !!b.getAttribute('aria-label') && b.getAttribute('aria-haspopup') === 'dialog' && b.getAttribute('aria-expanded') === 'false'; }));
  check('API prezent', await p.evaluate(() => ['open', 'close', 'get', 'set', 'reset', 'speak', 'stop', 'up'].every((k) => typeof FFF.a11y[k] === 'function')));
  check('fără erori JS/CSP', errors.length === 0, errors);
  await ctx.close();
}
for (const q of ['?kiosk=1', '?embed=1', '?noa11y=1']) {
  const {ctx, p} = await open(app.url, {init: NOWD, q});
  check('nu apare cu ' + q, await p.evaluate(() => !document.querySelector('[data-fff-a11y-ui]')));
  await ctx.close();
}
{
  const off = makeApp(page('<meta name="fff-a11y" content="off">'), {modules: 'core,store,a11y', info: false});
  const {ctx, p} = await open(off.url, {init: NOWD, q: ''});
  check('<meta name=fff-a11y content=off> îl oprește', await p.evaluate(() => !document.querySelector('[data-fff-a11y-ui]') && document.documentElement.getAttribute('data-fff-a11y') === 'off'));
  await ctx.close();
}
{
  const {ctx, p} = await open(app.url, {init: NOWD, q: ''});
  check('browser obișnuit (fără webdriver): se montează', await p.evaluate(() => !!document.querySelector('[data-fff-a11y-ui]')));
  await ctx.close();
}

console.log('panoul: deschidere, taste, setări');
{
  const {ctx, p} = await open(app.url);
  await p.click('.fff-a11y-aa'); await sleep(150);
  check('se deschide: aria-expanded=true, focus pe primul control', await p.evaluate(() => document.querySelector('.fff-a11y-aa').getAttribute('aria-expanded') === 'true' && !document.querySelector('.fff-a11y-panel').hidden && document.activeElement && document.activeElement.getAttribute('data-k') === 'sm'));
  check('titlul, etichetele și 100% sunt traduse (ro)', await p.evaluate(() => /Opțiuni de accesibilitate/.test(document.querySelector(".fff-a11y-panel h2").textContent) && document.querySelector('.fff-a11y-pc').textContent === '100%'));
  await p.click('.fff-a11y-panel [data-k=lg]'); await p.click('.fff-a11y-panel [data-k=lg]'); await sleep(200);
  check('A+ ×2: 120%, zoom pe <body>, salvat', await p.evaluate(() => document.querySelector('.fff-a11y-pc').textContent === '120%' && document.body.style.zoom === '1.2' && /"fs":1.2/.test(localStorage.getItem('fff.demo-fff.a11y') || '')));
  check('panoul și butonul NU sunt scalate de zoom-ul textului (stau sub <html>)', await p.evaluate(() => document.querySelector('.fff-a11y-aa').parentElement.parentElement === document.documentElement && Math.round(document.querySelector('.fff-a11y-aa').getBoundingClientRect().width) === 44));
  await p.click('.fff-a11y-panel [data-k=hc]');
  check('contrast ridicat: fundal negru, text alb, link cyan, pătratul colorat rămâne', await p.evaluate(() => { const g = (s) => getComputedStyle(document.querySelector(s)); return document.documentElement.classList.contains('fff-hc') && g('body').backgroundColor === 'rgb(0, 0, 0)' && g('main p').color === 'rgb(255, 255, 255)' && g('main a').color === 'rgb(125, 232, 255)' && g('#sq').backgroundColor === 'rgb(204, 51, 51)'; }));
  check('contrast ridicat: butonul are aria-pressed=true', await p.evaluate(() => document.querySelector('[data-k=hc]').getAttribute('aria-pressed') === 'true'));
  await p.click('.fff-a11y-panel [data-k=hc]');
  check('contrast ridicat oprit: culorile originale revin (și pătratul)', await p.evaluate(() => getComputedStyle(document.body).backgroundColor === 'rgb(255, 255, 255)' && getComputedStyle(document.querySelector('#sq')).backgroundColor === 'rgb(204, 51, 51)' && !document.querySelector('[data-fff-keep]')));
  await p.click('.fff-a11y-panel [data-k=rm]'); await p.click('.fff-a11y-panel [data-k=rf]'); await p.click('.fff-a11y-panel [data-k=ul]');
  check('fără animații / text lizibil / linkuri subliniate: clase și efect', await p.evaluate(() => { const c = document.documentElement.classList; return c.contains('fff-rm') && c.contains('fff-rf') && c.contains('fff-ul') && /Verdana/.test(getComputedStyle(document.querySelector('main p')).fontFamily) && getComputedStyle(document.querySelector('main a')).textDecorationLine === 'underline'; }));
  await p.keyboard.press('Escape'); await sleep(100);
  check('Esc închide panoul și întoarce focusul pe „Aa”', await p.evaluate(() => document.querySelector('.fff-a11y-panel').hidden && document.activeElement === document.querySelector('.fff-a11y-aa')));
  await p.reload(); await sleep(500);
  await p.evaluate(() => FFF.a11y.set({hc: 1})); await p.reload(); await sleep(500);
  check('contrast ridicat salvat: după reîncărcare pătratul colorat își păstrează culoarea', await p.evaluate(() => document.documentElement.classList.contains('fff-hc') && getComputedStyle(document.querySelector('#sq')).backgroundColor === 'rgb(204, 51, 51)'));
  await p.evaluate(() => FFF.a11y.set({hc: 0}));
  check('setările persistă după reîncărcare', await p.evaluate(() => { const c = document.documentElement.classList; return c.contains('fff-rm') && c.contains('fff-rf') && c.contains('fff-ul') && document.body.style.zoom === '1.2'; }));
  await p.click('.fff-a11y-aa'); await p.click('.fff-a11y-panel [data-k=rs]'); await sleep(200);
  check('Resetează tot: nicio clasă, fără zoom, cheia ștearsă', await p.evaluate(() => !/fff-(hc|rm|rf|ul|fsz)/.test(document.documentElement.className) && !document.body.style.zoom && localStorage.getItem('fff.demo-fff.a11y') === null));
  const v = await axe(p, '.fff-a11y-panel');
  check('axe pe panou: fără încălcări serioase', v.filter((x) => x.impact === 'serious' || x.impact === 'critical').length === 0, v);
  await ctx.close();
}
{
  const {ctx, p} = await open(app.url);
  await p.evaluate(() => { FFF.a11y.set({fs: 1.2, rm: 1}); });
  await p.reload(); await sleep(400);
  await p.evaluate(() => FFF.a11y.set({fs: 1.2, hc: 1}));
  await p.evaluate(() => FFF.a11y.reset());
  check('limba schimbată: etichetele panoului urmează limba', await (async () => { await p.evaluate(() => { document.documentElement.lang = 'en'; }); await sleep(300); return p.evaluate(() => /Accessibility options/.test(document.querySelector(".fff-a11y-panel h2").textContent)); })());
  await ctx.close();
}

console.log('potrivirea la ecran (panou mereu în ecran)');
for (const [name, w, h, touch] of [['desktop', 1280, 720, false], ['telefon', 360, 640, true], ['ecran scund', 640, 300, true], ['foarte îngust', 280, 480, true]]) {
  const {ctx, p} = await open(app.url, {w, h, touch});
  await p.click('.fff-a11y-aa'); await sleep(250);
  const b = await box(p, '.fff-a11y-panel');
  check(`${name} ${w}×${h}: panoul încape în ecran`, inScreen(b, w, h), b);
  check(`${name}: dacă e mai înalt decât ecranul se derulează în el`, await p.evaluate(() => { const e = document.querySelector('.fff-a11y-panel'); return e.scrollHeight <= e.clientHeight + 1 || getComputedStyle(e).overflowY === 'auto'; }));
  check(`${name}: „Închide” este accesibil (în ecran sau prin derulare)`, await p.evaluate(() => { const e = document.querySelector('.fff-a11y-panel [data-k=cl]'); e.scrollIntoView({block: 'nearest'}); const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
  await ctx.close();
}
{ // cu zoom-ul paginii (FFF.view) mare, panoul rămâne în ecran și are aceeași mărime
  const {ctx, p} = await open(app.url, {w: 800, h: 600});
  await p.evaluate(() => FFF.view.mount({force: true})); await sleep(800);
  for (let i = 0; i < 5; i++) await p.evaluate(() => FFF.view.zoomIn());
  await sleep(300);
  const z = await p.evaluate(() => FFF.view.get().total);
  await p.click('.fff-a11y-aa'); await sleep(250);
  const b = await box(p, '.fff-a11y-panel'), aa = await box(p, '.fff-a11y-aa');
  check(`zoom pagină ×${z.toFixed(2)}: panoul în ecran și butonul tot 44 px`, z > 1.5 && inScreen(b, 800, 600) && Math.round(aa.w) === 44, {z, b, aa});
  const vb = await box(p, '[data-fff-view]');
  // designul din kit 1.7: bara de zoom stă pe marginea din DREAPTA, la mijlocul înălțimii; panoul „Aa” (deasupra ei în stivă) o acoperă cât timp e deschis
  check('bara de zoom cu lupă / „potrivire ecran” e pe marginea din DREAPTA, la mijlocul înălțimii', vb && vb.r > 800 - 24 && Math.abs((vb.t + vb.b) / 2 - 300) < 140, vb);
  check('bara de zoom nu acoperă butonul „Aa” și panoul deschis stă deasupra ei în stivă', !(vb.r > aa.l && vb.l < aa.r && vb.b > aa.t && vb.t < aa.b) && await p.evaluate(() => Number(getComputedStyle(document.querySelector('.fff-a11y-panel')).zIndex) > Number(getComputedStyle(document.querySelector('[data-fff-view]')).zIndex)));
  await ctx.close();
}

console.log('săgeata „Înapoi sus”');
{
  const {ctx, p} = await open(app.url);
  check('ascunsă în capul paginii', await p.evaluate(() => document.querySelector('.fff-a11y-up').hidden));
  await p.evaluate(() => window.scrollTo(0, 1500)); await sleep(300);
  check('apare după derulare', await p.evaluate(() => !document.querySelector('.fff-a11y-up').hidden));
  await p.click('.fff-a11y-up'); await sleep(1300);
  check('duce sus și se ascunde; focus pe conținut', await p.evaluate(() => scrollY === 0 && document.querySelector('.fff-a11y-up').hidden && document.activeElement && /^(MAIN|H1)$/.test(document.activeElement.tagName)));
  await ctx.close();
}
{
  const inner = makeApp(`<!doctype html><html lang="ro"><head><meta charset="utf-8"><title>t</title><style>html,body{height:100%;margin:0;overflow:hidden}#s{height:100vh;overflow:auto}</style></head><body><main id="s"><h1>x</h1>${para}</main></body></html>`, {modules: 'core,store,a11y', info: false});
  const {ctx, p} = await open(inner.url);
  await p.evaluate(() => { document.getElementById('s').scrollTop = 1200; }); await sleep(300);
  check('zonă derulabilă proprie (nu pagina): săgeata apare', await p.evaluate(() => !document.querySelector('.fff-a11y-up').hidden));
  await p.click('.fff-a11y-up'); await sleep(1300);
  check('…și derulează zona respectivă sus', await p.evaluate(() => document.getElementById('s').scrollTop === 0));
  await ctx.close();
}

console.log('alegerea locului liber');
{
  const busy = makeApp(page('', '<button id="bb" style="position:fixed;right:0;bottom:0;width:70px;height:60px">x</button>'), {modules: 'core,store,a11y', info: false});
  const {ctx, p} = await open(busy.url);
  await sleep(300);
  const a = await box(p, '.fff-a11y-aa'), c = await box(p, '#bb');
  check('nu acoperă un control din colțul din dreapta jos', !(a.r > c.l && a.l < c.r && a.b > c.t && a.t < c.b), {a, c});
  await ctx.close();
}

console.log('„Sari la conținut”');
{
  const {ctx, p} = await open(app.url);
  check('legătura există și duce la <main>', await p.evaluate(() => { const a = document.querySelector('.fff-a11y-skip'); return a && a.getAttribute('href') === '#fff-main' && document.getElementById('fff-main').tagName === 'MAIN'; }));
  await ctx.close();
  const own = makeApp(page('', '').replace('<body>', '<body><a class="skip" href="#m">Sari</a>'), {modules: 'core,store,a11y', info: false});
  const r = await open(own.url);
  check('nu dublează o legătură proprie', await r.p.evaluate(() => !document.querySelector('.fff-a11y-skip')));
  await r.ctx.close();
}
await browser.close();
summary('a11y');
