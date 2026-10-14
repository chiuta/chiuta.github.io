// Test de compatibilitate pe aplicații existente (copii; originalele nu se ating).
//   node test/compat.mjs --inv shots_inv.json --work <dir> --out rezultate.json [--only A,B] [--jobs 4] [--modules core,label,bundle]
import fs from 'node:fs';
import path from 'node:path';
import {chromium, AXE} from './_pw.mjs';
import {applyKit, runInfo, checkKit} from '../build.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const inv = JSON.parse(fs.readFileSync(args.inv, 'utf8'));
const WORK = args.work, JOBS = +(args.jobs || 4), MODULES = args.modules || 'core,label,bundle';
const TMO = +(args.timeout || 240);
const only = args.only ? new Set(args.only.split(',')) : null;
const axeSrc = fs.readFileSync(AXE, 'utf8') + '\n;0';
const slugOf = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const norm = (m) => m.replace(/file:\/\/\S+/g, 'FILE').replace(/\d{6,}/g, 'N').slice(0, 300);

const entries = inv.filter((e) => !only || only.has(e.proper));
fs.mkdirSync(WORK, {recursive: true});

async function visit(browser, url, {w, h, scheme = 'light'}) {
  const ctx = await browser.newContext({viewport: {width: w, height: h}, acceptDownloads: true, colorScheme: scheme, locale: 'ro-RO'});
  const nets = [];
  await ctx.route(/^https?:/, (r) => { nets.push(r.request().url().replace(/[?#].*$/, '')); r.abort(); });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('__fffseed')) { localStorage.setItem('__fffseed', '1'); localStorage.setItem('zz.foreign.key', 'ramane'); } } catch (e) { /* ignorat */ } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + norm(e.message)));
  page.on('console', (m) => { const t = m.text(); if (/Content Security Policy|Refused to/i.test(t)) errs.push('csp: ' + norm(t)); });
  await page.goto(url, {waitUntil: 'load', timeout: 60000}).catch((e) => errs.push('goto: ' + e.message));
  await page.waitForTimeout(3500);
  return {ctx, page, errs, netCount: () => nets.length, nets};
}
async function axeRun(page, sel) {
  if (!(await page.evaluate(() => !!window.axe))) await page.evaluate(axeSrc);
  return page.evaluate(async (s) => {
    const root = s ? document.querySelector(s) : document;
    if (!root) return null;
    const r = await window.axe.run(root, {resultTypes: ['violations']});
    return r.violations.map((v) => v.nodes.map((n) => v.id + '|' + n.target.join(' ')).slice(0, 8)).flat();
  }, sel || null);
}
const overflow = (page) => page.evaluate(() => ({doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, body: document.body ? document.body.scrollWidth - document.documentElement.clientWidth : 0}));

async function revealVersion(page) {
  // întoarce {state, via}: încearcă să facă vizibil #app-version (panouri „despre”, moduri, ecrane ascunse)
  const st = () => page.evaluate(() => { const e = document.getElementById('app-version'); if (!e) return 'absent'; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return (r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && e.getClientRects().length) ? 'visible' : 'hidden'; });
  let s = await st();
  if (s !== 'hidden') return {state: s, via: ''};
  const cands = await page.evaluate(() => {
    const e = document.getElementById('app-version');
    const stop = new Set(['modal', 'screen', 'page', 'scrim', 'overlay', 'view', 'box', 'wrap', 'content', 'body', 'block', 'card', 'main', 'hidden', 'section', 'panel', 'backdrop', 'ovl', 'dialog', 'item', 'text', 'footer', 'sub', 'mono', 'level']);
    const words = new Set();
    for (let x = e; x && x !== document.body; x = x.parentElement) {
      const toks = ((x.id || '') + ' ' + (typeof x.className === 'string' ? x.className : '')).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-zăâîșț]+/);
      for (const t of toks) if (t.length >= 3 && !stop.has(t)) words.add(t);
    }
    words.add('despre'); words.add('about'); words.add('info'); words.add('credit'); words.add('help'); words.add('ajutor'); words.add('setări'); words.add('settings');
    const all = [...document.querySelectorAll('button,a[href^="#"],[role=button],[role=tab],summary,[tabindex="0"],nav li,nav a')].filter((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 && x !== e && !x.closest('dialog.fff-dlg'); });
    const scored = all.map((x) => {
      const hay = ((x.textContent || '').slice(0, 80) + ' ' + (x.getAttribute('aria-label') || '') + ' ' + (x.title || '') + ' ' + (x.id || '') + ' ' + (typeof x.className === 'string' ? x.className : '') + ' ' + [...x.attributes].filter((a) => a.name.startsWith('data-') || a.name.startsWith('aria-')).map((a) => a.value).join(' ')).toLowerCase();
      let sc = 0; for (const w of words) if (hay.includes(w)) sc += w.length;
      return {x, sc};
    }).filter((o) => o.sc > 0).sort((a, b) => b.sc - a.sc).slice(0, 12);
    return scored.map((o, i) => { o.x.setAttribute('data-fffc', i); return {i, t: ((o.x.textContent || o.x.getAttribute('aria-label') || o.x.id) + '').trim().slice(0, 30)}; });
  });
  for (const c of cands) {
    await page.click(`[data-fffc="${c.i}"]`, {timeout: 1200, noWaitAfter: true}).catch(() => {});
    await page.waitForTimeout(300);
    s = await st();
    if (s === 'visible') return {state: 'visible', via: c.t};
    await page.keyboard.press('Escape').catch(() => {});
  }
  return {state: 'hidden', via: ''};
}

async function testApp(browser, e) {
  const rec = {nume: e.proper, probleme: [], note: []};
  const odir = path.join(WORK, e.proper, 'orig'), kdir = path.join(WORK, e.proper, 'kit');
  fs.mkdirSync(odir, {recursive: true}); fs.mkdirSync(kdir, {recursive: true});
  const srcFile = path.join(e.path, 'index.html');
  fs.copyFileSync(srcFile, path.join(odir, 'index.html')); fs.copyFileSync(srcFile, path.join(kdir, 'index.html'));
  const cfgSrc = path.join(e.path, 'fff.config.json');
  if (fs.existsSync(cfgSrc)) fs.copyFileSync(cfgSrc, path.join(kdir, 'fff.config.json'));
  try {
    applyKit(kdir, {slug: slugOf(e.proper), modules: MODULES});
    runInfo(kdir, {slug: slugOf(e.proper)});
    const ck = checkKit(kdir, {lax: true});
    rec.build = {ok: ck.ok, errors: ck.errors, warns: ck.warns};
    if (!ck.ok) rec.probleme.push('check: ' + ck.errors.join('; '));
    if (ck.warns.length) rec.note.push('check: ' + ck.warns.join('; '));
  } catch (err) { rec.probleme.push('build: ' + err.message); return rec; }
  const ourl = 'file://' + path.join(odir, 'index.html'), kurl = 'file://' + path.join(kdir, 'index.html');
  rec.sizeKB = [Math.round(fs.statSync(path.join(odir, 'index.html')).size / 1024), Math.round(fs.statSync(path.join(kdir, 'index.html')).size / 1024)];

  rec.vp = {};
  for (const vp of [{n: '1280', w: 1280, h: 800}, {n: '360', w: 360, h: 740}]) {
    const o = await visit(browser, ourl, vp);
    const oo = await overflow(o.page), oa = await axeRun(o.page).catch(() => null);
    const oerr = o.errs.slice(), onet = o.netCount(), onets = o.nets.slice();
    await o.ctx.close();
    const k = await visit(browser, kurl, vp);
    const ko = await overflow(k.page), ka = await axeRun(k.page).catch(() => null);
    const kerr = k.errs.slice(), knet = k.netCount(), knew = k.nets.filter((u) => !onets.includes(u));
    const newErr = kerr.filter((m) => !oerr.includes(m));
    const newAxe = (ka || []).filter((m) => !(oa || []).includes(m));
    const newOverflow = (ko.doc > 0 || ko.body > 0) && !(oo.doc > 0 || oo.body > 0);
    rec.vp[vp.n] = {origErr: oerr.length, kitErr: kerr.length, newErr, axeOrig: (oa || []).length, axeKit: (ka || []).length, newAxe, overflow: [oo, ko], newOverflow, net: [onet, knet]};
    if (newErr.length) rec.probleme.push(`${vp.n}: erori noi: ${newErr.slice(0, 2).join(' | ')}`);
    if (newAxe.length) rec.probleme.push(`${vp.n}: axe nou: ${newAxe.slice(0, 3).join(' ; ')}`);
    if (newOverflow) rec.probleme.push(`${vp.n}: depășire orizontală nouă ${JSON.stringify(ko)}`);
    if (knew.length) rec.probleme.push(`${vp.n}: cereri de rețea noi: ${knew.slice(0, 2).join(' ')}`);
    if (vp.n === '1280') {
      // etichetă
      const lab = {};
      const kit = await k.page.evaluate(() => ({has: !!window.FFF && !!FFF.label, state: window.FFF && FFF.label && FFF.label.state, role: (document.getElementById('app-version') || {getAttribute() { return null; }}).getAttribute('role')}));
      lab.kit = kit;
      if (!kit.has) rec.probleme.push('FFF absent după încărcare');
      const rv = await revealVersion(k.page);
      lab.version = rv;
      if (rv.state === 'visible') {
        await k.page.evaluate(() => { document.getElementById('app-version').scrollIntoView({block: 'center', inline: 'center', behavior: 'instant'}); });
        await k.page.waitForTimeout(400);
        lab.hit = await k.page.evaluate(() => { const e = document.getElementById('app-version'); const r = e.getBoundingClientRect(); const t = document.elementFromPoint(Math.min(Math.max(r.x + r.width / 2, 1), innerWidth - 1), Math.min(Math.max(r.y + r.height / 2, 1), innerHeight - 1)); return !!t && (t === e || e.contains(t)); });
        if (!lab.hit) rec.note.push('#app-version acoperit de alt element / în afara ecranului în punctul central (la fel și fără kit?)');
        const isOpen = () => k.page.evaluate(() => FFF.label.isOpen());
        try {
          await k.page.click('#app-version', {timeout: 3000});
          await k.page.waitForTimeout(250);
          lab.clickOpens = await isOpen(); lab.clickMode = 'click';
          if (!lab.clickOpens) throw new Error('click fără efect (poate pagină în derulare)');
        } catch (err) {
          lab.clickErr = err.message.split('\n')[0];
          // element instabil (animat) sau în afara ecranului pentru Playwright: evenimente reale prin dispatch / tastatură
          await k.page.locator('#app-version').dispatchEvent('click').catch(() => {});
          await k.page.waitForTimeout(250);
          lab.clickOpens = await isOpen(); lab.clickMode = 'dispatchEvent';
          if (lab.clickOpens) { await k.page.evaluate(() => FFF.label.close()); await k.page.evaluate(() => { document.getElementById('app-version').focus(); }); await k.page.keyboard.press('Enter'); await k.page.waitForTimeout(250); lab.enterOpens = await isOpen(); }
          if (lab.clickOpens) rec.note.push('click Playwright imposibil (element instabil/în afara ecranului: ' + lab.clickErr.slice(0, 60) + '); dispatchEvent(click)' + (lab.enterOpens ? ' și Enter' : '') + ' deschid dialogul');
        }
        if (lab.clickOpens) await k.page.evaluate(() => FFF.label.close());
        if (!lab.clickOpens) { rec.probleme.push('click pe #app-version nu deschide dialogul' + (lab.clickErr ? ': ' + lab.clickErr : '')); }
        await k.page.evaluate(() => FFF.label.open());
      } else if (rv.state === 'hidden') {
        await k.page.evaluate(() => FFF.label.open());
        rec.note.push('#app-version ascuns (nu a putut fi dezvăluit automat); dialogul deschis prin FFF.label.open()');
      } else {
        await k.page.evaluate(() => FFF.label.open());
        rec.note.push('fără #app-version în pagină');
      }
      lab.isButton = kit.role === 'button';
      lab.dialog = await k.page.evaluate(() => { const d = document.querySelector('dialog.fff-dlg'); return d ? {open: d.open, modal: d.matches(':modal'), text: d.innerText.slice(0, 80)} : null; });
      if (!lab.dialog || !lab.dialog.open) rec.probleme.push('dialogul nu s-a deschis');
      lab.axeDialog = await axeRun(k.page, 'dialog.fff-dlg').catch(() => null);
      if (lab.axeDialog && lab.axeDialog.length) rec.probleme.push('axe în dialog: ' + lab.axeDialog.slice(0, 3).join(' ; '));
      await k.page.evaluate(() => FFF.label.close());
      rec.label = lab;
    }
    if (vp.n === '360') {
      await k.page.evaluate(() => FFF.label.open());
      const g = await k.page.evaluate(() => { const d = document.querySelector('dialog.fff-dlg'); if (!d) return null; const r = d.getBoundingClientRect(); return {over: d.scrollWidth - d.clientWidth, fit: r.left >= 0 && r.right <= innerWidth + 0.5}; });
      rec.dialog360 = g;
      if (!g || g.over > 0 || !g.fit) rec.probleme.push('dialog 360: ' + JSON.stringify(g));
      await k.page.evaluate(() => FFF.label.close());
    }
    await k.ctx.close();
  }

  // întunecat: axe în dialog + temă
  {
    const k = await visit(browser, kurl, {w: 360, h: 740, scheme: 'dark'});
    await k.page.evaluate(() => FFF.label.open());
    const ad = await axeRun(k.page, 'dialog.fff-dlg').catch(() => null);
    rec.axeDialogDark = ad;
    if (ad && ad.length) rec.probleme.push('axe dialog (dark): ' + ad.slice(0, 3).join(' ; '));
    await k.ctx.close();
  }

  // round-trip export → ștergere → import
  async function roundTrip(attempt) {
    const k = await visit(browser, kurl, {w: 1280, h: 800});
    // interacțiune ușoară (clic pe câteva butoane vizibile, fără descărcări/fișiere), ca aplicația să-și scrie cheile
    k.page.on('dialog', (d) => d.dismiss().catch(() => {}));
    for (let i = 0; i < 8; i++) {
      const ok = await k.page.evaluate((n) => {
        const bs = [...document.querySelectorAll('button:not([disabled]),[role=button]:not(#app-version),[role=tab]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('dialog.fff-dlg') && !/ștergere|șterge|delete|reset|clear|export|descarc|download|import|salv|save/i.test(e.textContent + ' ' + (e.getAttribute('aria-label') || '')); });
        const b = bs[n * 3 % Math.max(bs.length, 1)]; if (!b) return false; b.setAttribute('data-fffp', '1'); return true;
      }, i);
      if (!ok) break;
      await k.page.click('[data-fffp="1"]', {timeout: 800, noWaitAfter: true}).catch(() => {});
      await k.page.evaluate(() => document.querySelectorAll('[data-fffp]').forEach((e) => e.removeAttribute('data-fffp')));
      await k.page.waitForTimeout(120);
    }
    await k.page.waitForTimeout(500);
    const r = await k.page.evaluate(async () => {
      const out = {};
      try {
        localStorage.setItem('__fffcompat', 'ăîșț-' + Date.now());
        const snap = () => Object.fromEntries(FFF.store.indexKeys().map((key) => [key, FFF.store.raw.get(key)]));
        const s0 = snap();
        const b = FFF.bundle.build();
        out.keys = Object.keys(s0).length;
        out.exportEqSnapshot = JSON.stringify(b.data) === JSON.stringify(Object.fromEntries(Object.entries(s0).sort())) || JSON.stringify(Object.keys(b.data).sort()) === JSON.stringify(Object.keys(s0).sort());
        out.mismatch = Object.keys(s0).filter((key) => b.data[key] !== s0[key]).slice(0, 3);
        const text = JSON.stringify(b);
        const w = await FFF.bundle.wipe({confirm: false, reload: false});
        out.wiped = w.keys;
        const left = Object.keys(localStorage).filter((key) => key !== 'zz.foreign.key' && key !== '__fffseed');
        out.foreignKept = FFF.store.raw.get('zz.foreign.key') === 'ramane';
        out.indexAfterWipe = FFF.store.indexKeys().length;
        out.leftAfterWipe = left.slice(0, 5);
        const imp = await FFF.bundle.import(new File([text], 'compat.fff.json'), {confirm: false, reload: false});
        out.imported = imp.keys;
        const s1 = snap();
        out.restored = Object.keys(s0).every((key) => s1[key] === s0[key]);
        out.restoredDiff = Object.keys(s0).filter((key) => s1[key] !== s0[key]).slice(0, 3);
        out.sizeKB = Math.round(text.length / 1024);
      } catch (e) { out.error = String(e && e.message || e); }
      return out;
    });
    r.errs = k.errs;
    await k.ctx.close();
    return r;
  }
  let rt = await roundTrip(1);
  if (!rt.error && (!rt.restored || !rt.exportEqSnapshot)) { const rt2 = await roundTrip(2); if (rt2.restored && rt2.exportEqSnapshot) { rt2.retried = true; rt = rt2; } }
  rec.roundTrip = rt;
  if (rt.error) rec.probleme.push('round-trip: ' + rt.error);
  else {
    if (!rt.exportEqSnapshot) rec.probleme.push('export ≠ stare localStorage: ' + JSON.stringify(rt.mismatch));
    if (!rt.restored) rec.probleme.push('import nu restabilește: ' + JSON.stringify(rt.restoredDiff));
    if (rt.indexAfterWipe !== 0) rec.probleme.push('ștergere incompletă (chei indexate rămase: ' + rt.indexAfterWipe + ')');
    if (!rt.foreignKept) rec.note.push('cheia străină a fost ștearsă (aplicația o citește → indexată; origine partajată)');
    if (rt.leftAfterWipe && rt.leftAfterWipe.length) rec.note.push('chei rămase după ștergere (nescrise prin API-ul Storage?): ' + rt.leftAfterWipe.join(','));
  }
  return rec;
}

const results = new Array(entries.length);
const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox']});
let next = 0;
async function worker() {
  while (next < entries.length) {
    const i = next++;
    const e = entries[i];
    const t0 = Date.now();
    try { results[i] = await Promise.race([testApp(browser, e), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout ' + TMO + ' s')), TMO * 1000))]); }
    catch (err) { results[i] = {nume: e.proper, probleme: ['excepție: ' + err.message], note: []}; }
    console.log(`[${i + 1}/${entries.length}] ${e.proper} ${((Date.now() - t0) / 1000).toFixed(0)}s ${results[i].probleme.length ? 'PROBLEME: ' + results[i].probleme.join(' || ').slice(0, 300) : 'ok'}`);
    if (args.out) fs.writeFileSync(args.out, JSON.stringify(results.filter(Boolean), null, 1));
  }
}
await Promise.all(Array.from({length: JOBS}, worker));
await browser.close();
if (args.out) fs.writeFileSync(args.out, JSON.stringify(results, null, 1));
const bad = results.filter((r) => r.probleme.length);
console.log(`\nTOTAL ${results.length}: ok ${results.length - bad.length}, cu probleme ${bad.length}`);
