// Test pe toate aplicațiile cu modulul `view`: bara de zoom stă pe margine, în ecran, fără să acopere
// butoane/câmpuri/linkuri sau ✕, antetele de tabel sunt fixe, iar ?noview=1 oprește bara.
// Rădăcina aplicațiilor: FFF_APPS (director cu un subdirector per aplicație; implicit /home/claude/apps).
// Se sar aplicațiile fără modulul view (de ex. cele scrise în Rust). Rulează în paralel (FFF_CONC, implicit 4).
import fs from 'node:fs';
import path from 'node:path';
import {launch, newPage, check, summary} from './_pw.mjs';

const ROOT = process.env.FFF_APPS || '/home/claude/apps';
const ONLY = (process.env.FFF_ONLY || '').split(',').filter(Boolean);
const CONC = +process.env.FFF_CONC || 4;
if (!fs.existsSync(ROOT)) { console.log('view-apps: ' + ROOT + ' lipsește — sărit'); process.exit(0); }
const apps = fs.readdirSync(ROOT).filter((d) => !ONLY.length || ONLY.includes(d)).filter((d) => {
  const f = path.join(ROOT, d, 'index.html');
  return fs.existsSync(f) && /FFF\.view|fff-view|data-fff-view/.test(fs.readFileSync(f, 'utf8'));
}).sort();
console.log('view-apps: ' + apps.length + ' aplicații în ' + ROOT);

// Excepții cunoscute: interfețe cu poziție fixă pe toată lățimea, unde nicio înălțime nu e liberă (bara rămâne la minimul de suprapunere).
const KNOWN = {NOMIA: 'bară de file fixă pe toată lățimea pe telefon', MarkdownAtelier: 'butoane proprii flotante pe ambele margini pe telefon'};
const VPS = [{n: 'telefon', w: 390, h: 844}, {n: 'desktop', w: 1280, h: 720}];
const MEASURE = () => {
  const bar = document.querySelector('[data-fff-view]');
  if (!bar) return {none: true};
  const R = (e) => e.getBoundingClientRect(), b = R(bar), vw = innerWidth, vh = innerHeight;
  const hit = (a, c) => Math.min(a.right, c.right) - Math.max(a.left, c.left) > 1 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 1;
  const ex = document.querySelector('.fff-exit');
  const over = [];
  document.querySelectorAll('a[href],button,input,select,textarea,summary,[role=button],[role=tab],[role=menuitem],[onclick]').forEach((e) => {
    if (bar.contains(e) || (ex && ex.contains(e))) return;
    const cs = getComputedStyle(e), r = R(e);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0 || r.width < 4 || r.height < 4) return;
    if (!hit(b, r)) return;
    const ov = Math.min(b.right, r.right) - Math.max(b.left, r.left);
    if (r.width >= 100 && ov / r.width <= 0.35) return;                                // carusel / card larg doar atins la margine
    const t = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 0), vw - 1), Math.min(Math.max(r.top + r.height / 2, 0), vh - 1));
    if (!t || (!e.contains(t) && !t.contains(e) && !bar.contains(t))) return;           // acoperit de altceva (ex. strat închis)
    over.push((e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : '')));
  });
  const th = document.querySelector('table:not([role=presentation]):not([role=none]) > thead > tr > th');
  return {rect: {l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height}, vw, vh, exit: ex ? (() => { const e = R(ex); return hit(b, e); })() : false,
    over: over.slice(0, 5), nOver: over.length, th: th ? getComputedStyle(th).position : null};
};

async function one(browser, name) {
  const url = 'file://' + path.join(ROOT, name, 'index.html');
  for (const vp of VPS) {
    const {ctx, page} = await newPage(browser, {w: vp.w, h: vp.h});
    try {
      await page.goto(url, {waitUntil: 'load', timeout: 30000});
      await page.waitForTimeout(1500);
      const api = await page.evaluate(() => !!(window.FFF && FFF.view && FFF.view.mount));
      check(`${name} ${vp.n}: API FFF.view`, api);
      if (!api) continue;
      await page.evaluate(() => { FFF.view.mount({force: true}); });
      await page.waitForTimeout(1600);
      const m = await page.evaluate(MEASURE);
      if (m.none) { check(`${name} ${vp.n}: bara există`, false); continue; }
      const r = m.rect;
      check(`${name} ${vp.n}: bara în ecran, pe margine, verticală`, r.l >= -1 && r.r <= m.vw + 1 && r.t >= 0 && r.b <= m.vh + 1 && r.h > r.w * 2 && (r.r >= m.vw - 24 || r.l <= 24), JSON.stringify(r));
      check(`${name} ${vp.n}: nu acoperă ✕`, !m.exit);
      check(`${name} ${vp.n}: nu acoperă controale (${m.over.join(', ')})`, m.nOver === 0 || (KNOWN[name] && vp.n === 'telefon'), KNOWN[name] || undefined);
      if (m.th) check(`${name} ${vp.n}: antet de tabel fix`, m.th === 'sticky', m.th);
    } catch (e) { check(`${name} ${vp.n}: rulare`, false, String(e.message).slice(0, 200)); }
    finally { await ctx.close().catch(() => {}); }
  }
  const {ctx, page} = await newPage(browser, {w: 390, h: 844});
  try {
    await page.goto(url + '?noview=1', {waitUntil: 'load', timeout: 30000});
    await page.waitForTimeout(1000);
    check(`${name}: ?noview=1 oprește bara`, (await page.evaluate(() => !document.querySelector('[data-fff-view]'))));
  } catch (e) { check(`${name}: noview`, false, String(e.message).slice(0, 200)); }
  finally { await ctx.close().catch(() => {}); }
}

const browser = await launch();
const q = apps.slice();
await Promise.all(Array.from({length: CONC}, async () => { while (q.length) await one(browser, q.shift()); }));
await browser.close();
summary('view-apps');
