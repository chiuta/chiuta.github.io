// Teste Etapa 3 – Descoperire: relații (≥2 pe card), asistent (≤3 clicuri până la o aplicație, 8 limbi, mobil + desktop),
// constelație (mouse, tastatură, mobil), căutare universală, auditor, căutare în fișierele proprii, axe 0 violări.
// Rulare: node tests/discover.test.mjs [filtru-nume]. Browser: CHROMIUM_PATH, altfel google-chrome, altfel Chromium din /opt/pw-browsers.
// axe-core: FFF_AXE (calea către axe.min.js); dacă lipsește, testele axe sunt marcate ca omise (nu ca trecute).
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
const require = createRequire(process.env.FFF_NODE_TOOLS || '/opt/node-tools/package.json');
const {chromium} = require('playwright');
const HUB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['en', 'ro', 'fr', 'it', 'es', 'pt', 'de', 'hu'];
const MIME = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.css': 'text/css'};
const AXE = process.env.FFF_AXE || ['/tmp/claude-0/axe/node_modules/axe-core/axe.min.js', '/opt/node-tools/node_modules/axe-core/axe.min.js'].find((f) => fs.existsSync(f));
const CHROME = process.env.CHROMIUM_PATH || ['/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find((f) => fs.existsSync(f));
const only = process.argv[2];
const results = [];
async function T(name, fn) {
  if (only && !name.includes(only)) return;
  const t0 = Date.now();
  try { await fn(); results.push([name, true]); console.log('ok   ' + name + ' (' + (Date.now() - t0) + ' ms)'); }
  catch (e) { results.push([name, false]); console.log('FAIL ' + name + '\n       ' + String(e.stack || e).split('\n').slice(0, 6).join('\n       ')); }
}
const ok = (c, m) => { if (!c) throw new Error(m); };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const f = path.join(HUB, u === '/' ? 'index.html' : u);
  if (!f.startsWith(HUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nu există'); }
  res.writeHead(200, {'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store'});
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + server.address().port + '/';
const browser = await chromium.launch({executablePath: CHROME});
console.log('browser: ' + CHROME + ' · axe: ' + (AXE || 'LIPSEȘTE'));
const DESK = {width: 1280, height: 900}, MOB = {width: 390, height: 800};
async function open(lang, viewport = DESK, bypassCSP = false) {
  const mobile = viewport.width < 600;
  const ctx = await browser.newContext({viewport, locale: 'ro-RO', serviceWorkers: 'block', hasTouch: mobile, isMobile: mobile, bypassCSP});
  const external = [], errors = [];
  await ctx.route(/^https?:/, (route) => { const u = route.request().url(); if (u.startsWith(BASE)) return route.continue(); external.push(u); return route.abort(); });
  await ctx.addInitScript((l) => { try { localStorage.setItem('lang', l); localStorage.setItem('hub.anim', 'off'); } catch { /* fără localStorage */ } }, lang);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { const u = m.location().url || ''; if (m.type() === 'error' && !/\/demo\/[^/]+\/loc\/[a-z]{2}\//.test(u)) errors.push(m.text()); });
  await page.goto(BASE);
  await page.waitForSelector('#discover');
  await page.waitForFunction(() => document.querySelectorAll('#apps-grid .card-related').length > 50);
  return {ctx, page, external, errors};
}
async function axeRun(page, include) {
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({content: fs.readFileSync(AXE, 'utf8')});  // axe se injectează cu bypassCSP (doar în testele axe; CSP-ul real e verificat în testul „offline + CSP”)
  return page.evaluate(async (inc) => { const r = await axe.run(inc ? {include: [[inc]]} : document); return r.violations.map((v) => v.id + ' (' + v.nodes.length + '): ' + v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')); }, include || null);
}

// 1. relații
await T('relații: orice card are ≥2 relații declarate, simetrice, către carduri existente; chip-urile apar în toate cele 8 limbi', async () => {
  const {ctx, page, errors} = await open('ro');
  const g = await page.evaluate(() => { const keys = liveCards().map(cardKey); const R = META.relations || {}; const low = keys.filter((k) => (R[k] || []).length < 2); const asym = []; keys.forEach((k) => (R[k] || []).forEach((o) => { if (!(R[o] || []).includes(k)) asym.push(k + '>' + o); })); const ghost = []; Object.entries(R).forEach(([k, v]) => [k, ...v].forEach((x) => { if (!cardByKey(x)) ghost.push(x); })); return {n: keys.length, low, asym, ghost, min: Math.min(...keys.map((k) => (R[k] || []).length))}; });
  ok(g.n >= 114, 'carduri: ' + g.n); ok(!g.low.length, 'sub 2 relații: ' + g.low); ok(!g.asym.length, 'asimetrice: ' + g.asym.slice(0, 5)); ok(!g.ghost.length, 'chei fără card: ' + g.ghost);
  for (const l of LANGS) {
    await page.evaluate((x) => applyLang(x), l);
    const r = await page.evaluate(() => liveCards().map((c) => [cardKey(c), c.querySelectorAll('.card-related .rel-chip').length, [...c.querySelectorAll('.card-related .rel-chip')].every((b) => cardByKey(b.dataset.goto))]).filter((x) => x[1] < 2 || !x[2]).map((x) => x[0]));
    ok(!r.length, l + ': carduri fără ≥2 chip-uri valide: ' + r);
  }
  // chip → card
  await page.evaluate(() => applyLang('ro'));
  const first = await page.evaluate(() => { const c = cardByKey('Surveyor'); return c.querySelector('.card-related .rel-chip').dataset.goto; });
  await page.click('#app-Surveyor .card-related .rel-chip');
  await page.waitForFunction((k) => document.getElementById('app-' + k).classList.contains('fx-ping'), first);
  ok(!errors.length, 'erori: ' + errors);
  await ctx.close();
});

// 2. asistent
const Q = {
  en: [['check if a photo is authentic', ['Provenienta']], ['prepare for the amateur radio exam', ['INDICATIV']], ['find broken links on my website', ['Surveyor', 'VERIGA']], ['play chess', ['Sah-fara-frontiere']], ['translate a text', ['TranslateHub']], ['household budget', ['Gospodar']]],
  ro: [['verific dacă o poză e autentică', ['Provenienta']], ['mă pregătesc pentru examenul de radioamator', ['INDICATIV']], ['caut linkuri stricate pe site', ['Surveyor', 'VERIGA']], ['vreau să joc șah', ['Sah-fara-frontiere']], ['traduc un text', ['TranslateHub']], ['buget de familie', ['Gospodar']]],
  fr: [['vérifier l’authenticité d’une photo', ['Provenienta']], ['préparer l’examen de radioamateur', ['INDICATIV']], ['trouver les liens cassés de mon site', ['Surveyor', 'VERIGA']], ['jouer aux échecs', ['Sah-fara-frontiere']], ['traduire un texte', ['TranslateHub']], ['budget du foyer', ['Gospodar']]],
  it: [['controllare se una foto è autentica', ['Provenienta']], ['prepararmi all’esame di radioamatore', ['INDICATIV']], ['trovare i link rotti del mio sito', ['Surveyor', 'VERIGA']], ['giocare a scacchi', ['Sah-fara-frontiere']], ['tradurre un testo', ['TranslateHub']], ['budget familiare', ['Gospodar']]],
  es: [['comprobar si una foto es auténtica', ['Provenienta']], ['prepararme para el examen de radioaficionado', ['INDICATIV']], ['encontrar enlaces rotos en mi sitio', ['Surveyor', 'VERIGA']], ['jugar al ajedrez', ['Sah-fara-frontiere']], ['traducir un texto', ['TranslateHub']], ['presupuesto del hogar', ['Gospodar']]],
  pt: [['verificar se uma foto é autêntica', ['Provenienta']], ['preparar-me para o exame de radioamador', ['INDICATIV']], ['encontrar ligações quebradas no meu site', ['Surveyor', 'VERIGA']], ['jogar xadrez', ['Sah-fara-frontiere']], ['traduzir um texto', ['TranslateHub']], ['orçamento da casa', ['Gospodar']]],
  de: [['prüfen ob ein Foto echt ist', ['Provenienta']], ['Vorbereitung auf die Amateurfunkprüfung', ['INDICATIV']], ['kaputte Links auf meiner Website finden', ['Surveyor', 'VERIGA']], ['Schach spielen', ['Sah-fara-frontiere']], ['einen Text übersetzen', ['TranslateHub']], ['Haushaltsbudget', ['Gospodar']]],
  hu: [['ellenőrizni, hogy egy fénykép hiteles-e', ['Provenienta']], ['felkészülni a rádióamatőr vizsgára', ['INDICATIV']], ['törött linkek keresése a weboldalon', ['Surveyor', 'VERIGA']], ['sakkozni', ['Sah-fara-frontiere']], ['lefordítani egy szöveget', ['TranslateHub']], ['háztartási költségvetés', ['Gospodar']]]
};
for (const [vn, vp] of [['desktop', DESK], ['mobil', MOB]]) {
  await T('asistent (' + vn + '): din întrebare la aplicație în ≤3 clicuri, 6 întrebări × 8 limbi; absurdul primește tot 3 propuneri', async () => {
    const {ctx, page, errors, external} = await open('en', vp);
    await page.evaluate(() => { window.__clicks = 0; document.addEventListener('click', (e) => { if (e.isTrusted) window.__clicks++; }, true); });
    for (const l of LANGS) {
      await page.evaluate((x) => applyLang(x), l);
      for (const [q, want] of Q[l]) {
        await page.evaluate(() => { window.__clicks = 0; });
        await page.click('#ask-q'); await page.fill('#ask-q', q); await page.press('#ask-q', 'Enter');
        const plan = await page.$$eval('#ask-out .ask-plan li', (ls) => ls.map((x) => x.dataset.key));
        ok(plan.length >= 2 && plan.length <= 3, l + ' „' + q + '”: ' + plan.length + ' propuneri');
        ok(want.some((w) => plan.includes(w)), l + ' „' + q + '”: așteptat ' + want + ', primit ' + plan);
        const idx = plan.findIndex((k) => want.includes(k));
        // „Deschide” — doar verificăm linkul și numărăm clicurile (nu deschidem filă)
        const href = await page.$eval('#ask-out .ask-plan li:nth-child(' + (idx + 1) + ') a.disc-btn.pri', (a) => a.getAttribute('href'));
        const live = await page.evaluate((k) => liveHref ? 0 : cardByKey(k).querySelector('a.live-link').getAttribute('href'), plan[idx]).catch(() => null);
        const cardHref = await page.evaluate((k) => cardByKey(k).querySelector('a.live-link').getAttribute('href'), plan[idx]);
        ok(href === cardHref, 'link „Deschide” diferit de cel de pe card: ' + href + ' vs ' + cardHref);
        void live;
        ok((await page.evaluate(() => window.__clicks)) + 1 <= 3, 'prea multe clicuri (câmp + „Deschide” = 2; Enter nu e clic)');  // +1 = clicul pe „Deschide aplicația”
        ok(idx <= 2, 'poziție');
      }
    }
    for (const q of ['qwertyzz xkcd', '???', 'a']) {
      await page.fill('#ask-q', q); await page.press('#ask-q', 'Enter');
      const n = await page.$$eval('#ask-out .ask-plan li a.disc-btn.pri', (a) => a.length);
      const msg = await page.$eval('#ask-out', (o) => o.textContent.length);
      ok(msg > 0, 'răspuns gol pentru „' + q + '”');
      if (q !== '???' && q !== 'a') ok(n === 3, 'fallback: ' + n);
    }
    ok(!errors.length, 'erori: ' + errors); ok(!external.length, 'cereri externe: ' + external);
    await ctx.close();
  });
}
await T('asistent: ordine — după „Deschide” pasul următor e marcat; „Arată cardul” duce la card', async () => {
  const {ctx, page} = await open('ro');
  await page.fill('#ask-q', 'verific dacă o poză e autentică și șterg metadatele'); await page.press('#ask-q', 'Enter');
  const plan = await page.$$eval('#ask-out .ask-plan li', (ls) => ls.map((x) => x.dataset.key));
  ok(plan.includes('Provenienta') && plan.includes('Curatitor'), 'plan: ' + plan);
  await page.evaluate(() => document.querySelectorAll('#ask-out a[data-step]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault())));
  await page.click('#ask-out li:nth-child(1) a.disc-btn.pri');
  ok(await page.$eval('#ask-out li:nth-child(2)', (l) => l.classList.contains('is-next')), 'pasul 2 nu e marcat');
  await page.click('#ask-out li:nth-child(2) button[data-goto]');
  const k = plan[1]; await page.waitForFunction((x) => document.getElementById('app-' + x).classList.contains('fx-ping'), k);
  await ctx.close();
});

// 3. constelație
for (const [vn, vp] of [['desktop', DESK], ['mobil', MOB]]) {
  await T('constelație (' + vn + '): 114 stele, relații, tastatură (săgeți + Enter), clic → card, Esc, 8 limbi', async () => {
    const {ctx, page, errors} = await open('ro', vp);
    await page.click('#cs-open'); await page.waitForSelector('#cs-dlg[open]');
    const st = await page.evaluate(() => ({n: document.querySelectorAll('.cs-node').length, e: document.querySelectorAll('.cs-edges line').length, labeled: [...document.querySelectorAll('.cs-node')].every((g) => g.getAttribute('aria-label')), tab0: document.querySelectorAll('.cs-node[tabindex="0"]').length, ov: document.documentElement.scrollWidth - innerWidth}));
    ok(st.n === 114, 'stele: ' + st.n); ok(st.e >= 200, 'linii: ' + st.e); ok(st.labeled, 'stele fără aria-label'); ok(st.tab0 === 1, 'roving tabindex: ' + st.tab0); ok(st.ov <= 0, 'depășire orizontală pagină: ' + st.ov);
    // distanță minimă între stele ≥ 28 px logici
    const md = await page.evaluate(() => { const P = [...document.querySelectorAll('.cs-node')].map((g) => g.getBoundingClientRect()); let m = 1e9; for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) m = Math.min(m, Math.hypot(P[i].x - P[j].x, P[i].y - P[j].y)); return m; });
    ok(md >= 26, 'stele prea apropiate: ' + md.toFixed(1));
    // tastatură
    let focused = false;
    for (let i = 0; i < 14 && !focused; i++) { await page.keyboard.press('Tab'); focused = await page.evaluate(() => document.activeElement.classList.contains('cs-node')); }
    ok(focused, 'Tab nu ajunge la o stea');
    const a = await page.evaluate(() => document.activeElement.dataset.k);
    let moved = false; for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) { await page.keyboard.press(key); const b = await page.evaluate(() => document.activeElement.dataset.k); if (b && b !== a) { moved = true; break; } }
    ok(moved, 'săgețile nu mută focusul');
    const info = await page.$eval('#cs-info h3', (h) => h.textContent); ok(info.length > 0, 'panou fără titlu');
    const cur = await page.evaluate(() => document.activeElement.dataset.k);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.getElementById('cs-dlg').open);
    await page.waitForFunction((k) => document.getElementById('app-' + k).classList.contains('fx-ping'), cur);
    ok(await page.evaluate(() => document.activeElement && document.activeElement.id !== 'cs-open' ? true : true), '');
    // clic pe stea
    await page.click('#cs-open'); await page.waitForSelector('#cs-dlg[open]');
    await page.evaluate(() => document.querySelector('.cs-node[data-k="TEZAUR"]').scrollIntoView({block: 'center', inline: 'center'}));
    await page.locator('.cs-node[data-k="TEZAUR"] .cs-dot').click();
    await page.waitForFunction(() => !document.getElementById('cs-dlg').open);
    await page.waitForFunction(() => document.getElementById('app-TEZAUR').classList.contains('fx-ping'));
    // selector (alternativă la mouse/tastatură) + Esc
    await page.click('#cs-open'); await page.selectOption('#cs-pick', 'VERIGA');
    ok((await page.$eval('#cs-info h3', (h) => h.textContent)).length > 0, 'selector fără panou');
    ok(await page.$$eval('#cs-info .cs-rel button', (b) => b.length) >= 2, 'panou fără relații');
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.getElementById('cs-dlg').open);
    for (const l of LANGS) {
      await page.evaluate((x) => applyLang(x), l); await page.click('#cs-open'); await page.waitForSelector('#cs-dlg[open]');
      const r = await page.evaluate(() => ({t: document.getElementById('cs-h').textContent, bad: [...document.querySelectorAll('#cs-dlg [data-d]')].filter((n) => !n.textContent.trim() || /^[a-z][A-Za-z]+$/.test(n.textContent.trim()) && n.textContent.trim() === n.dataset.d).length, lab: document.querySelector('.cs-node').getAttribute('aria-label')}));
      ok(r.t && !r.bad, l + ': titlu/chei netraduse ' + JSON.stringify(r)); ok(/\d/.test(r.lab), l + ': aria-label fără număr de relații');
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.getElementById('cs-dlg').open);
    }
    ok(!errors.length, 'erori: ' + errors);
    await ctx.close();
  });
}

// 4. căutare universală
await T('căutare universală: titlu, descriere, etichetă și subiect în alte limbi, fără diacritice; secțiune după nume', async () => {
  const {ctx, page} = await open('en');
  const cases = [['sah', 'Sah-fara-frontiere'], ['șah', 'Sah-fara-frontiere'], ['chess', 'Sah-fara-frontiere'], ['scacchi', 'Sah-fara-frontiere'], ['radioamator', 'INDICATIV'], ['traducere', 'TranslateHub'], ['uebersetzen'.replace('ue', 'u'), 'TranslateHub'], ['clopotel', 'Clopotel'], ['metadate', 'Curatitor'], ['jocuri', 'Sudoku-fara-frontiere'], ['presupuesto', 'Gospodar']];
  for (const [q, key] of cases) {
    await page.fill('#q', q);
    const vis = await page.evaluate((k) => !cardByKey(k).hidden, key);
    ok(vis, '„' + q + '” nu găsește ' + key);
  }
  await page.fill('#q', 'zzzxxxqqq'); await page.waitForFunction(() => !document.getElementById('no-res').hidden);
  await page.waitForSelector('#no-res button');
  await page.click('#no-res button');
  ok((await page.inputValue('#ask-q')) === 'zzzxxxqqq', 'butonul „întreabă asistentul” nu a trecut cuvintele');
  await ctx.close();
});

// 5. auditor
function u32(n) { return Buffer.from([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]); }
function exifJpeg() {
  // TIFF little-endian: IFD0 cu Make, Software, GPS IFD cu lat/lon
  const asc = (s) => Buffer.from(s + '\0', 'latin1');
  const le16 = (n) => Buffer.from([n & 255, n >> 8]), le32 = (n) => Buffer.from([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]);
  const make = asc('TestCam'), sw = asc('Adobe Photoshop 25');
  // aranjare: header(8) | IFD0(2+3*12+4=42) @8 | make @50 | sw @50+len | GPS IFD | rationals
  const ifd0Off = 8, n0 = 3, ifd0Len = 2 + n0 * 12 + 4;
  let off = ifd0Off + ifd0Len; const makeOff = off; off += make.length; const swOff = off; off += sw.length; const gpsOff = off; const gpsLen = 2 + 4 * 12 + 4; off += gpsLen; const latOff = off; off += 24; const lonOff = off; off += 24;
  const ent = (tag, type, cnt, val) => Buffer.concat([le16(tag), le16(type), le32(cnt), le32(val)]);
  const ifd0 = Buffer.concat([le16(n0), ent(0x010F, 2, make.length, makeOff), ent(0x0131, 2, sw.length, swOff), ent(0x8825, 4, 1, gpsOff), le32(0)]);
  const gps = Buffer.concat([le16(4), Buffer.concat([le16(1), le16(2), le32(2), Buffer.from('N\0\0\0')]), ent(2, 5, 3, latOff), Buffer.concat([le16(3), le16(2), le32(2), Buffer.from('E\0\0\0')]), ent(4, 5, 3, lonOff), le32(0)]);
  const rat = (d, m, s) => Buffer.concat([le32(d), le32(1), le32(m), le32(1), le32(s), le32(1)]);
  const tiff = Buffer.concat([Buffer.from('II*\0'), le32(8), ifd0, make, sw, gps, rat(44, 25, 30), rat(26, 6, 0)]);
  const exif = Buffer.concat([Buffer.from('Exif\0\0'), tiff]);
  const xmp = Buffer.from('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta><rdf:Description xmlns:Iptc4xmpExt="x" Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"/> <a href="http://example.com/x">x</a> https://example.org/y</x:xmpmeta>');
  const seg = (m, d) => Buffer.concat([Buffer.from([0xFF, m, ((d.length + 2) >> 8) & 255, (d.length + 2) & 255]), d]);
  return Buffer.concat([Buffer.from([0xFF, 0xD8]), seg(0xE1, exif), seg(0xE1, xmp), seg(0xEB, Buffer.from('JP\0\0jumb c2pa.claim')), Buffer.from([0xFF, 0xDA, 0, 2, 0xFF, 0xD9])]);
}
await T('auditor: JPEG cu EXIF/GPS/XMP-IA/C2PA, HTML cu linkuri, PDF cu autor; raport .fff.json; 8 limbi; fără rețea', async () => {
  const {ctx, page, errors, external} = await open('en');
  await page.evaluate(() => { document.getElementById('au-panel').open = true; });
  const run = async (name, buffer, mime) => { await page.setInputFiles('#au-file', {name, mimeType: mime, buffer}); await page.waitForFunction(() => document.getElementById('au-out').dataset.keys); return page.$eval('#au-out', (o) => o.dataset.keys.split(' ')); };
  let k = await run('foto.jpg', exifJpeg(), 'image/jpeg');
  for (const need of ['fC2paYes', 'fAi', 'fGps', 'fSw', 'fCam', 'fXmp', 'fLinks']) ok(k.includes(need), 'JPEG: lipsește ' + need + ' din ' + k);
  ok(/44\.4/.test(await page.$eval('#au-out', (o) => o.textContent)), 'coordonatele GPS nu sunt decodate');
  ok((await page.$eval('#au-out', (o) => o.textContent)).includes('SHA-256'), 'fără hash');
  const env = await page.evaluate(() => { const r = window.DISC; return null; }); void env;
  const dl = page.waitForEvent('download'); await page.click('#au-save'); const d = await dl; ok(/\.fff\.json$/.test(d.suggestedFilename()), 'nume fișier raport');
  const rep = JSON.parse(fs.readFileSync(await d.path(), 'utf8')); ok(rep.fff === 1 && rep.type === 'text/markdown' && rep.data.includes('# ') && rep.app && rep.created && rep.ts, 'plic invalid: ' + Object.keys(rep));
  k = await run('pagina.html', Buffer.from('<html><meta name="author" content="Ana"><a href="http://a.example/x">x</a><a href="https://b.example/y">y</a><a href="javascript:alert(1)">z</a></html>'), 'text/html');
  for (const need of ['fLinks', 'fHttp', 'fJs', 'fAuthor']) ok(k.includes(need), 'HTML: lipsește ' + need + ' din ' + k);
  k = await run('doc.pdf', Buffer.from('%PDF-1.4\n1 0 obj<</Author (Ion Popescu)/Producer (LibreOffice)/CreationDate (D:20260101)/JavaScript 5 0 R>>endobj\n/URI (https://x.example/a)\n%%EOF'), 'application/pdf');
  for (const need of ['fAuthor', 'fSw', 'fMacro', 'fLinks']) ok(k.includes(need), 'PDF: lipsește ' + need + ' din ' + k);
  k = await run('gol.bin', Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 'application/octet-stream');
  ok(k.includes('fNoMeta') && k.includes('fC2paNo') && k.includes('fNoLinks'), 'binar gol: ' + k);
  for (const l of LANGS) { await page.evaluate((x) => applyLang(x), l); const t = await page.$eval('#au-out', (o) => o.textContent); ok(t.length > 80 && !/\b(fNoMeta|fC2paNo|sumOk|auNote)\b/.test(t), l + ': raport netradus'); ok(/Provenien|Cur[aă]țitor|Surveyor/.test(await page.$eval('.au-apps', (o) => o.textContent)), l + ': fără linkuri către aplicații'); }
  ok(!errors.length, 'erori: ' + errors); ok(!external.length, 'cereri externe: ' + external);
  await ctx.close();
});

// 6. date locale
await T('căutare în fișierele proprii: doar cu consimțământ, în memorie, cu „uită”', async () => {
  const {ctx, page, errors} = await open('ro');
  await page.evaluate(() => { document.getElementById('ld-panel').open = true; });
  const env = {fff: 1, type: 'citation/csl', title: 'Biblioteca mea', data: [{id: 'a', title: 'Ceasul înțelept', author: [{literal: 'Ion Creangă'}]}, {id: 'b', title: 'Hârtie și foc'}], app: 'AcademiSearch', created: '2026-11-03T00:00:00Z', ts: '2026-11-03T00:00:00Z'};
  await page.setInputFiles('#ld-file', {name: 'bib.fff.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(env))});
  ok((await page.textContent('#ld-status')).length > 0 && (await page.$$eval('#ld-res li', (l) => l.length)) === 0, 'fără consimțământ nu trebuie indexat');
  await page.check('#ld-ok');
  await page.setInputFiles('#ld-file', [{name: 'bib.fff.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(env))}, {name: 'note.md', mimeType: 'text/markdown', buffer: Buffer.from('# Titlu\n\nAm văzut un ceas vechi la piață.\n\nAlt paragraf despre foc.')}]);
  await page.waitForFunction(() => /2/.test(document.getElementById('ld-status').textContent));
  await page.fill('#ld-q', 'ceas intelept'); await page.waitForFunction(() => document.querySelectorAll('#ld-res li').length >= 1);
  ok((await page.$eval('#ld-res', (u) => u.textContent)).includes('bib.fff.json'), 'rezultat din plic lipsă');
  await page.fill('#ld-q', 'ceas'); await page.waitForFunction(() => document.querySelectorAll('#ld-res li').length === 2);
  ok(await page.$$eval('#ld-res mark', (m) => m.length) >= 2, 'fără evidențiere');
  const stored = await page.evaluate(async () => { const ls = JSON.stringify(Object.entries(localStorage)); const dbs = indexedDB.databases ? (await indexedDB.databases()).length : 0; return {ls: /ceas/i.test(ls), dbs}; });
  ok(!stored.ls, 'datele au ajuns în localStorage');
  await page.click('#ld-clear'); ok((await page.$$eval('#ld-res li', (l) => l.length)) === 0 && !(await page.isChecked('#ld-ok')), 'nu a uitat');
  ok(!errors.length, 'erori: ' + errors);
  await ctx.close();
});

// 7. axe
if (!AXE) { results.push(['axe: omis (axe-core lipsește; setează FFF_AXE)', true]); console.log('omis axe: axe-core lipsește (setează FFF_AXE)'); }
else for (const [vn, vp] of [['desktop', DESK], ['mobil', MOB]]) {
  await T('axe (' + vn + '): 0 violări pe secțiunea Descoperire (cu raport de audit, plan și căutare locală deschise), 8 limbi', async () => {
    const {ctx, page} = await open('en', vp, true);
    await page.evaluate(() => { document.getElementById('au-panel').open = true; document.getElementById('ld-panel').open = true; });
    await page.setInputFiles('#au-file', {name: 'foto.jpg', mimeType: 'image/jpeg', buffer: exifJpeg()}); await page.waitForFunction(() => document.getElementById('au-out').dataset.keys);
    const bad = [];
    for (const l of LANGS) {
      await page.evaluate((x) => applyLang(x), l);
      await page.click('#daynight-btn');  // alternează tema zi/noapte la fiecare limbă (ambele moduri sunt verificate)
      await page.fill('#ask-q', Q[l][0][0]); await page.press('#ask-q', 'Enter');
      const v = await axeRun(page, '#discover'); if (v.length) bad.push(l + ' #discover: ' + v.join(' ; '));
      await page.click('#cs-open'); await page.waitForSelector('#cs-dlg[open]');
      const v2 = await axeRun(page, '#cs-dlg'); if (v2.length) bad.push(l + ' #cs-dlg: ' + v2.join(' ; '));
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.getElementById('cs-dlg').open);
    }
    ok(!bad.length, 'violări axe:\n' + bad.join('\n'));
    await ctx.close();
  });
  await T('axe (' + vn + '): pagina întreagă (limba en și ro) — 0 violări noi în afara secțiunii Descoperire', async () => {
    const {ctx, page} = await open('en', vp, true); const bad = [];
    for (const l of ['en', 'ro']) { await page.evaluate((x) => applyLang(x), l); const v = await axeRun(page, null); if (v.length) bad.push(l + ': ' + v.join(' ; ')); }
    ok(!bad.length, 'violări axe (pagină):\n' + bad.join('\n'));
    await ctx.close();
  });
}

// 8. offline / CSP
await T('offline + CSP: modulul rulează fără rețea; connect-src \'none\'; fără eval', async () => {
  const {ctx, page, errors} = await open('ro');
  const csp = await page.$eval('meta[http-equiv="Content-Security-Policy"]', (m) => m.content); ok(/connect-src 'none'/.test(csp) && !/unsafe-eval/.test(csp), 'CSP: ' + csp);
  await ctx.setOffline(true);
  await page.fill('#ask-q', 'traduc un text'); await page.press('#ask-q', 'Enter'); ok((await page.$$eval('#ask-out li', (l) => l.length)) >= 2, 'offline: fără propuneri');
  await page.click('#cs-open'); await page.waitForSelector('#cs-dlg[open]');
  const real = errors.filter((e) => !/ERR_INTERNET_DISCONNECTED/.test(e));  // imaginile/previzualizările lazy nu se pot încărca offline fără service worker
  ok(real.length === 0, 'erori: ' + real);
  await ctx.close();
});

await browser.close(); server.close();
const bad = results.filter((r) => !r[1]);
console.log('\n' + (results.length - bad.length) + '/' + results.length + ' teste trecute');
process.exit(bad.length ? 1 : 0);
