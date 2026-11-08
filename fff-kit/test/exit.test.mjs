// Teste FFF.exit (kit 1.3.0): buton „Închide” pe telefon. Rulare: node test/exit.test.mjs
import fs from 'node:fs';
import {makeApp, launch, check, summary, FIXTURE, sleep} from './_pw.mjs';

const browser = await launch();
const NOWD = "Object.defineProperty(navigator, 'webdriver', {get: () => false});";   // simulează un browser obișnuit (nu automatizat)
async function phone(url, {init, touch = true, w = 390, h = 844} = {}) {
  const ctx = await browser.newContext({viewport: {width: w, height: h}, isMobile: touch, hasTouch: touch, deviceScaleFactor: 2});
  await ctx.route(/^https?:/, (r) => r.abort());
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|aborted/i.test(m.text())) errors.push(m.text()); });
  if (init) await page.addInitScript(init);
  await page.goto(url); await page.waitForTimeout(400);
  return {ctx, page, errors};
}
const app = makeApp(FIXTURE, {modules: 'core,exit', info: false});

console.log('montare condiționată');
{
  const {ctx, page} = await phone(app.url);        // Playwright => navigator.webdriver = true
  check('browser automatizat: nu se montează singur', await page.evaluate(() => !document.querySelector('[data-fff-exit]')));
  await ctx.close();
}
{
  const {ctx, page, errors} = await phone(app.url, {init: NOWD});
  check('telefon obișnuit: butonul există, are nume accesibil și ≥44 px', await page.evaluate(() => { const b = document.querySelector('.fff-exit-btn'); const r = b.getBoundingClientRect(); return !!b && b.getAttribute('aria-label') === 'Închide aplicația' && r.width >= 44 && r.height >= 44; }));
  check('butonul e în ecran și apare deasupra conținutului (stratul de sus, sub dialoguri)', await page.evaluate(() => { const r = document.querySelector('.fff-exit-btn').getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return r.x >= 0 && r.right <= innerWidth && r.y >= 0 && r.bottom <= innerHeight && !!e && e.closest('.fff-exit-btn') !== null && +getComputedStyle(document.querySelector('.fff-exit')).zIndex < 2147483000; }));
  check('fără erori JS/CSP', errors.length === 0, errors);
  await ctx.close();
}
{
  const {ctx, page} = await phone(app.url, {init: NOWD, touch: false, w: 1280, h: 800});
  check('desktop (mouse): nu apare', await page.evaluate(() => !document.querySelector('[data-fff-exit]')));
  await ctx.close();
}
{
  const html = '<!doctype html><meta charset=utf-8><iframe src="' + app.url + '" width=300 height=300></iframe>';
  const d = makeApp(html, {modules: 'core', info: false}).dir; fs.writeFileSync(d + '/outer.html', html);
  const {ctx, page} = await phone('file://' + d + '/outer.html', {init: NOWD});
  const inner = page.frames().find((f) => f !== page.mainFrame());
  check('în iframe: nu apare', !inner || await inner.evaluate(() => !document.querySelector('[data-fff-exit]')));
  await ctx.close();
}
{
  for (const q of ['?kiosk=1', '?embed=1', '?noexit=1']) {
    const {ctx, page} = await phone(app.url + q, {init: NOWD});
    check('nu apare cu ' + q, await page.evaluate(() => !document.querySelector('[data-fff-exit]')));
    await ctx.close();
  }
  const off = makeApp(FIXTURE.replace('</head>', '<meta name="fff-exit" content="off"></head>'), {modules: 'core,exit', info: false});
  const {ctx, page} = await phone(off.url, {init: NOWD});
  check('<meta name=fff-exit content=off> îl oprește', await page.evaluate(() => !document.querySelector('[data-fff-exit]')));
  await ctx.close();
}

console.log('alegerea colțului liber');
{
  const busy = (corners) => FIXTURE.replace('</body>', corners.map((c) => `<button style="position:fixed;${c.includes('t') ? 'top:0' : 'bottom:0'};${c.includes('r') ? 'right:0' : 'left:0'};width:70px;height:70px">x</button>`).join('') + '</body>');
  for (const [taken, want] of [[[], 'tr'], [['tr'], 'tl'], [['tr', 'tl'], 'br'], [['tr', 'tl', 'br'], 'bl']]) {
    const a = makeApp(busy(taken), {modules: 'core,exit', info: false});
    const {ctx, page} = await phone(a.url, {init: NOWD});
    const got = await page.evaluate(() => FFF.exit.probe());
    check(`colțuri ocupate [${taken.join(',')}] → ${want}`, got === want, got);
    await ctx.close();
  }
  const a = makeApp(busy(['tr']), {modules: 'core,exit', info: false});
  const {ctx, page} = await phone(a.url, {init: NOWD});
  await page.setViewportSize({width: 844, height: 390}); await page.waitForTimeout(700);
  check('după rotire alege tot un colț liber (nu cel ocupat)', await page.evaluate(() => FFF.exit.corner() !== 'tr'));
  await ctx.close();
}

console.log('confirmare și închidere');
{
  const {ctx, page} = await phone(app.url, {init: NOWD + 'window.__closed = 0; window.close = () => { window.__closed++; };'});
  await page.tap('.fff-exit-btn');
  check('atingerea cere confirmarea (două butoane, ≥44 px)', await page.evaluate(() => { const p = document.querySelector('.fff-exit-pop'); const bs = [...p.querySelectorAll('button')]; return !p.hidden && bs.length === 2 && bs.every((b) => b.getBoundingClientRect().height >= 44) && p.textContent.includes('Închizi aplicația?'); }));
  await page.tap('.fff-exit-no');
  check('„Rămâi” închide fereastra de confirmare, aplicația rămâne', await page.evaluate(() => document.querySelector('.fff-exit-pop').hidden && !window.__closed));
  await page.tap('.fff-exit-btn'); await page.keyboard.press('Escape');
  check('Escape închide confirmarea', await page.evaluate(() => document.querySelector('.fff-exit-pop').hidden));
  await page.tap('.fff-exit-btn'); await page.tap('.fff-exit-yes');
  check('„Închide” apelează window.close()', await page.evaluate(() => window.__closed === 1));
  await ctx.close();
}
{
  // fila nu se poate închide (PWA / filă fără istoric): se întoarce în hub; rețeaua e blocată, deci verificăm ținta cererii
  const {ctx, page} = await phone(app.url, {init: NOWD + 'window.close = () => { };'});
  const nav = [];
  await ctx.route(/^https:\/\/chiuta\.ro\//, (r) => { nav.push(r.request().url()); r.abort(); });
  await page.tap('.fff-exit-btn'); await page.tap('.fff-exit-yes'); await sleep(900);
  check('dacă fila rămâne deschisă: navighează la https://chiuta.ro/', nav.some((u) => u === 'https://chiuta.ro/'), nav);
  await ctx.close();
}
{
  const {ctx, page} = await phone(app.url, {init: NOWD + 'window.close = () => { };'});
  await page.evaluate(() => { const b = document.querySelector('.fff-exit-btn'); b.click(); });
  const hubMeta = makeApp(FIXTURE.replace('</head>', '<meta name="fff-hub" content="https://exemplu.test/hub/"></head>'), {modules: 'core,exit', info: false});
  await ctx.close();
  const c2 = await phone(hubMeta.url, {init: NOWD + 'window.close = () => { };'});
  const nav = [];
  await c2.ctx.route(/^https:\/\/exemplu\.test\//, (r) => { nav.push(r.request().url()); r.abort(); });
  await c2.page.tap('.fff-exit-btn'); await c2.page.tap('.fff-exit-yes'); await sleep(900);
  check('meta fff-hub schimbă ținta', nav.includes('https://exemplu.test/hub/'), nav);
  await c2.ctx.close();
}

console.log('plin ecran și limbi');
{
  const {ctx, page} = await phone(app.url, {init: NOWD});
  await page.evaluate(() => { document.body.insertAdjacentHTML('beforeend', '<div id="fsbox" style="background:#222;min-height:200px">box</div>'); });
  const ok = await page.evaluate(async () => { try { await document.getElementById('fsbox').requestFullscreen(); return true; } catch (e) { return false; } });
  if (ok) { await page.waitForTimeout(700); check('plin ecran pe un element: butonul se mută în acel element', await page.evaluate(() => document.querySelector('[data-fff-exit]').parentNode.id === 'fsbox'));
    await page.evaluate(() => document.exitFullscreen()); await page.waitForTimeout(700);
    check('după ieșire revine în body', await page.evaluate(() => document.querySelector('[data-fff-exit]').parentNode === document.body)); }
  else check('plin ecran indisponibil în acest mediu (omis)', true);
  await ctx.close();
}
{
  const LANGS = {ro: 'Închizi aplicația?', en: 'Close the app?', fr: "Fermer l'application ?", it: "Chiudere l'app?", es: '¿Cerrar la aplicación?', pt: 'Fechar a aplicação?', de: 'App schließen?', hu: 'Bezárod az alkalmazást?'};
  const J = JSON.parse(fs.readFileSync(new URL('../i18n/exit.json', import.meta.url), 'utf8'));
  check('exit.json: 4 chei în toate cele 8 limbi', Object.keys(LANGS).every((l) => ['btn', 'ask', 'yes', 'no'].every((k) => J[l] && J[l][k])), Object.keys(J));
  const {ctx, page} = await phone(app.url, {init: NOWD});
  for (const [l, txt] of Object.entries(LANGS)) {
    await page.evaluate((l) => document.documentElement.setAttribute('lang', l), l); await page.waitForTimeout(150);
    await page.evaluate(() => document.querySelector('.fff-exit-btn').click());
    check('limba ' + l + ': „' + txt + '”', await page.evaluate((t) => document.querySelector('.fff-exit-pop').textContent.includes(t), txt));
    await page.evaluate(() => { const p = document.querySelector('.fff-exit-pop'); if (!p.hidden) document.querySelector('.fff-exit-no').click(); });
  }
  await ctx.close();
}
console.log('API');
{
  const {ctx, page} = await phone(app.url, {touch: false, w: 1280, h: 800});
  const r = await page.evaluate(() => ({before: !!document.querySelector('[data-fff-exit]'), mounted: FFF.exit.mount({force: true}), after: !!document.querySelector('[data-fff-exit]')}));
  check('mount({force:true}) îl pune și pe desktop', !r.before && r.mounted && r.after, r);
  await page.evaluate(() => FFF.exit.hide());
  check('hide() îl ascunde', await page.evaluate(() => document.querySelector('[data-fff-exit]').hidden));
  await ctx.close();
}
await browser.close();
summary('exit');
